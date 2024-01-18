const files = require('./helpers/files');
const g = require('./global');
const log = require('./helpers/ca_log');
const m = require('./helpers/mqtt_publish');
const fs = require('fs');
const schedule = require('node-schedule');

//#region Types and const
const InventoryType = {
	Piece: 0,
	Bulk: 1,
	Quart: 2,
	Gallon: 3,
	Ounce: 4
};

const NonQtyInventoryTypes = [InventoryType.Bulk];

const defaultItem = {
	"ItemNumber": undefined,
	"CurrentQty": 0,
	"MinQty": 0,
	"Description": "",
	"SourceURL": "",
	"InventoryType": 0,
	"Manufacturer": "",
	"PartNumber": "",
	"Location": "",
	"Category": "",
	"Barcodes": []
};

const defaultConfig = {
	StartingItemNumber: 100,
	NextItemNumber: 100,
	ReuseDeletedItemNumbers: false
};

const appConfigFilename = 'appconfig.json';
const shoppingListFilename = 'shoppingList.json';
const itemFileNameSuffix = '_item.json';
const itemFileNameSuffixObsolete = '_obsolete.json'

let missingItemNumbers = undefined;
let obsoleteItems = [];
let invList = [];
let shoppingList = [];
let shoppingListLastSet;
let shouldAllowExternalShoppingListUpdates = false;
let appConfigFullPath;
let shoppingListFullPath;
//#endregion

//#region Config
/**
 * Configure application
 */
const setupApp = async (args) => {
	try {
		// First set globals
		g.Globals.dataFolder = args.dataFolder || '/data/';
		g.Globals.logTopic = args.logTopic || 'logs';
		const topicFolder = args.topicFolder || 'inventory_ca';
		g.Globals.invConsumeTopic = args.invConsumeTopic || `${topicFolder}/consume`;
		g.Globals.addUpdateItemTopic = args.addUpdateItemTopic || `${topicFolder}/addupdate`;
		g.Globals.invUpdatedTopic = args.invUpdatedTopic || `${topicFolder}/updated`;
		g.Globals.actionResponseTopic = args.actionResponseTopic || `${topicFolder}/actionresponse`;
		g.Globals.shoppingListTopic = args.shoppingListTopic || `${topicFolder}/shoppinglist`;
		g.Globals.mqttServerAddress = args.mqttServerAddress;
		g.Globals.logLevel = args.logLevel;

		// Now can refer to the globals and setup this class
		const appConfigPath = `${g.Globals.dataFolder}config/`;
		appConfigFullPath = `${appConfigPath}${appConfigFilename}`;
		shoppingListFullPath = `${g.Globals.dataFolder}${shoppingListFilename}`;
		log.debug('setupApp', { appConfigPath: appConfigFullPath, dataPath: g.Globals.dataFolder });
		fs.mkdirSync(appConfigPath, { recursive: true }, (err) => {
			if (err) log.error(`Error making app config directory: ${appConfigPath}`, err);
			g.exitAppEarly('Unable to make app config directory');
		});
		fs.mkdirSync(g.Globals.dataFolder, { recursive: true }, (err) => {
			if (err) log.error(`Error making data directory: ${g.Globals.dataFolder}`, err)
			g.exitAppEarly('Unable to make data directory');
		});
		g.Globals.appConfig = await files.readJsonFile(appConfigFullPath);
		if (g.Globals.appConfig == null) {
			await loadInitialConfig();
		} else {
			// Add potentially missing properties
			if (g.Globals.appConfig.ReuseDeletedItemNumbers === undefined)
				g.Globals.appConfig.ReuseDeletedItemNumbers = defaultConfig.ReuseDeletedItemNumbers;
		}
		g.validateConfig();
		await getShoppingList();
		log.debug('setupAppComplete', g.Globals.appConfig);
		await pushInvUpdatedEvent();
	} catch (err) {
		log.error('Error in setupApp', err);
	}
};

/**
 * Write inital config if none was found
 */
const loadInitialConfig = async () => {
	try {
		log.debug('loadInitialConfig');
		g.Globals.appConfig = defaultConfig;
		await writeAppConfig();
		await files.writeJsonFile(shoppingListFullPath, shoppingList);
	} catch (err) {
		log.error('Error in loadInitialConfig', err);
	}
};

/**
 * Save app config to disk
 */
const writeAppConfig = async () => {
	try {
		log.debug('writeAppConfig');
		await files.writeJsonFile(appConfigFullPath, g.Globals.appConfig);
	} catch (err) {
		log.error('Error in writeAppConfig', err);
	}
};
//#endregion

//#region Helper Methods
/**
 * Build inventory json file name
 * @param {string} number
 * @returns File name string
 */
const getFileName = (number, isObsolete = false) => {
	if (isObsolete)
		return g.Globals.dataFolder + number + itemFileNameSuffixObsolete;
	else
		return g.Globals.dataFolder + number + itemFileNameSuffix;
};

/**
 * Handle all the inventory update logic
 * @param {object} oldItem Old inventory object (or default if new)
 * @param {object} newItem New inventory object
 * @returns Updated inventory object
 */
const updateInvItem = (oldItem, newItem) => {
	log.debug('Updating inv item', { 'oldItem': oldItem, 'newItem': newItem });
	oldItem.CurrentQty = newItem.CurrentQty;
	oldItem.MinQty = newItem.MinQty;
	oldItem.Description = newItem.Description?.trim();
	oldItem.SourceURL = newItem.SourceURL?.trim();
	oldItem.InventoryType = newItem.InventoryType;
	oldItem.Manufacturer = newItem.Manufacturer?.trim();
	oldItem.PartNumber = newItem.PartNumber?.trim();
	oldItem.Location = newItem.Location?.trim();
	oldItem.Category = newItem.Category?.trim();
	oldItem.Obsolete = newItem.Obsolete;
	oldItem.Barcodes = newItem.Barcodes;

	if (NonQtyInventoryTypes.includes(newItem.InventoryType)) {
		oldItem.CurrentQty = null;
		oldItem.MinQty = null;
	}

	return oldItem;
};
//#endregion

//#region Read/Write Items
/**
 * Read inventory item from data storage
 * @param {string} number Inventory item number
 * @returns Inventory object from storage
 */
const readInvItem = async (number) => {
	try {
		log.debug(`readInvItem ${number}`);
		const fullName = getFileName(number);
		const data = await files.readJsonFile(fullName);
		if (data == null) {
			log.error(`Asked to read item that doesn't exist: ${number}`);
			return null;
		}
		return data;
	} catch (err) {
		log.error(`Error reading item ${number}`, err);
	}
};

/**
 * Save inventory object to storage
 * @param {object} data Inventory object
 */
const writeInvItem = async (data) => {
	try {
		log.debug(`writeInvItem ${data.ItemNumber}`);
		const fullName = getFileName(data.ItemNumber, data.Obsolete);
		await files.writeJsonFile(fullName, data);
	} catch (err) {
		log.error(`Error writing item ${number}`, err);
	}
};
//#endregion

//#region Consume Event
/**
 * Subtract 1 from a piece item and add to shopping list if needed, or add a bulk item to the shopping list
 * @param {string} number Inventory item number
 * @returns Nothing
 */
const consumeItem = async (number) => {
	try {
		log.debug(`Consuming ${number}`);
		const data = await readInvItem(number);
		if (data == null) {
			log.error(`Invalid inventory item consumed: ${number}`);
			return;
		}
		if (!NonQtyInventoryTypes.includes(data.InventoryType)) {
			data.CurrentQty--;
			await writeInvItem(data);
			await addRemoveShoppingList(data);
		} else {
			await addToShoppingList(data);
		}
	} catch (err) {
		log.error('Error in consumeItem', err);
	} finally {
		await pushInvUpdatedEvent();
	}
};
//#endregion

//#region Add/Update Event
/**
 * Add a new object if no ItemNumber is included, or update an existing item. Add to shopping list if needed.
 * @param {object} data Inventory object
 * @returns Nothing
 */
const addUpdateItem = async (data) => {
	try {
		let updatedItem;
		if (data.ItemNumber == null || data.ItemNumber == undefined) {
			// No item number in payload or null
			updatedItem = updateInvItem(defaultItem, data);
			updatedItem.ItemNumber = getNextItemNumber();

		} else {
			// Item number was included in payload
			existing = await readInvItem(data.ItemNumber);
			if (existing != null) {
				// Existing item found
				updatedItem = updateInvItem(existing, data);
			}
			else {
				updatedItem = updateInvItem(defaultItem, data);
				updatedItem.ItemNumber = data.ItemNumber;
			};
		}
		await writeInvItem(updatedItem);
		await addRemoveShoppingList(updatedItem);
		return;
	} catch (err) {
		log.error(err, `Error adding/updating item`);
	} finally {
		pushInvUpdatedEvent();
	}
};

/**
 * Get next item number, or a missing number if configured to do so
 * @returns Next item number
 */
const getNextItemNumber = () => {
	log.debug('getNextItemNumber');
	if (g.Globals.appConfig.ReuseDeletedItemNumbers === true) {
		if (missingItemNumbers === undefined || missingItemNumbers.length === 0) {
			return g.Globals.appConfig.NextItemNumber;
		} else {
			return Math.min(...missingItemNumbers)
		}
	} else {
		return g.Globals.appConfig.NextItemNumber;
	}
}
//#endregion

//#region Shopping List
/**
 * Read shopping list from file and update the shoppingList variable
 */
const getShoppingList = async () => {
	log.debug('getShoppingList');
	try {
		shoppingList = await files.readJsonFile(shoppingListFullPath);
		shouldAllowExternalShoppingListUpdates = false;
		return;
	} catch (err) {
		log.error('Error reading shopping list from file', err);
		shouldAllowExternalShoppingListUpdates = true;
	}
};

const externalShoppingListUpdate = (data) => {
	if (!shouldAllowExternalShoppingListUpdates)
		return;
	var difference = shoppingListLastSet - new Date();
	if (difference < 5000)
		return;
	shouldAllowExternalShoppingListUpdates = false; // Set it now to prevent future updates from overwriting the list
	shoppingList = data;
	shoppingListLastSet = new Date();
}

/**
 * Update and publish shopping list
 * @param {Array} listData In-memory shopping list array
 */
const updateShoppingList = async (listData) => {
	shoppingListLastSet = new Date();
	if (JSON.stringify(listData) == JSON.stringify(shoppingList))
		return;
	log.debug('updateShoppingList', listData);
	shoppingList = listData;
	await files.writeJsonFile(shoppingListFullPath, shoppingList);
	await m.publishShoppingList(shoppingList);
};

/**
 * Handle the adding/removing of items of the shopping list
 * @param {object} data Inventory object
 */
const addRemoveShoppingList = async (data) => {
	log.debug('addRemoveShoppingList', data);
	if (!NonQtyInventoryTypes.includes(data.InventoryType)) {
		if (data.CurrentQty < data.MinQty)
			await addToShoppingList(data);
		else
			await removeIfOnShoppingList(data);
	}
};

/**
 * Internal worker function for the addRemoveShoppingList function
 * @param {object} data Inventory object
 */
const addToShoppingList = async (data) => {
	log.debug('addToShoppingList', data);
	try {
		let shList = JSON.parse(JSON.stringify(shoppingList));
		if (shList != null) {
			const shListIncludes = shList.includes(shList.find(l => l.ItemNumber === data.ItemNumber));
			if (!shListIncludes)
				// Not on the shopping list - time to add it
				shList.push(data);
			else {
				const index = shList.findIndex(l => l.ItemNumber === data.ItemNumber);
				let existing = shList[index];
				// Existing is the existing item on the shopping list, not to be confused with
				//  whether or not it exists, which is checked above
				existing = updateInvItem(existing, data);
			};
		} else {
			shList = [];
			shList.push(data);
		}
		await updateShoppingList(shList);
		return true;
	} catch (err) {
		log.error('Error in addToShoppingList', err);
		return false;
	}
}

/**
 * Internal worker function for the addRemoveShoppingList function
 * @param {object} data Inventory object
 * @returns Nothing
 */
const removeIfOnShoppingList = async (data) => {
	log.debug('removeIfOnShoppingList', data);
	let shList = shoppingList;
	if (shList == null)
		return;
	const exists = shList.includes(shList.find(l => l.ItemNumber === data.ItemNumber));
	if (!exists)
		return;
	shList = shList.filter(item => item.ItemNumber !== data.ItemNumber);
	updateShoppingList(shList);
}

const shoppingListJob = schedule.scheduleJob('* * 23 * *', function () {
	shoppingList;
});
//#endregion

//#region Inventory Updated Event
/**
 * Start the inventory update event. Callback on separate method
 */
const pushInvUpdatedEvent = async () => {
	try {
		log.debug('pushInvUpdatedEvent');
		invList = [];
		await files.readAllJsonFiles(g.Globals.dataFolder, handleFileData);
		pushInvUpdatedEventCallback(invList);
		invList = [];
	} catch (err) {
		log.error('Error in pushInvUpdatedEvent', err);
	}
}

const handleFileData = async (filename, data) => {
	if (filename.includes(itemFileNameSuffix)) {
		invList.push(data)
		await addRemoveShoppingList(data);
	} else if (filename.includes(itemFileNameSuffixObsolete)) {
		obsoleteItems.push(data.ItemNumber);
		removeIfOnShoppingList(data);
	}
}

/**
 * Callback method from pushInvUpdatedEvent
 * @param {object} data Inventory object
 * @returns Nothing
 */
const pushInvUpdatedEventCallback = (data) => {
	log.debug('pushInvUpdatedEventCallback');
	if (data === undefined || data === null) {
		log.error(null, 'Unable to pull existing inventory');
		m.publish('Unable to pull existing inventory to update ' + g.Globals.actionResponseTopic, g.Globals.actionResponseTopic, 1, true);
		return;
	}
	const results = findMissing(data);
	missingItemNumbers = results.missing;
	g.Globals.appConfig.NextItemNumber = results.maxUsed + 1;
	m.publishInvUpdated(data);
	writeAppConfig();
}

/**
 * Find missing ItemNumbers in the array
 * @param {*} data Inventory data array
 * @returns missing- Array of missing numbers, maxUsed- Highest used number, minUsed- Lowest used number]
 */
const findMissing = data => {
	const itemNumbers = data.map((d) => d.ItemNumber);
	const max = Math.max(...itemNumbers); // Will find highest number
	const min = Math.min(...itemNumbers); // Will find lowest number
	const missing = [];

	for (let i = min; i <= max; i++) {
		if (!itemNumbers.includes(i)) { // Checking whether i(current value) present in num(argument)
			missing.push(i); // Adding numbers which are not in num(argument) array
		}
	}
	return {
		missing: missing,
		maxUsed: max,
		minUsed: min
	};
}

const updateJob = schedule.scheduleJob('* * 23 * *', function () {
	pushInvUpdatedEvent();
});
//#endregion

module.exports = {
	setupApp,
	writeAppConfig,
	consumeItem,
	addUpdateItem,
	shoppingListJob,
	updateJob,
	addToShoppingList,
	externalShoppingListUpdate
};
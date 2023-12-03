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

const NotQtyInventoryTypes = [InventoryType.Bulk];

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
	"Category": ""
};

const defaultConfig = {
	StartingItemNumber: 100,
	NextItemNumber: 100,
	ReuseDeletedItemNumbers: false
};

const appConfigFilename = 'appconfig.json';
const itemFileNameSuffix = '_item.json';

let appConfigPath;
let dataFilePath;
let missingItemNumbers = undefined;
let shoppingListPath;
//#endregion

//#region Config
/**
 * Configure application
 */
const setupApp = async () => {
	try {
		appConfigPath = g.Globals.dataFolder + 'config/';
		dataFilePath = g.Globals.dataFolder;
		shoppingListPath = `${dataFilePath}shoppingList.json`
		// log.verbose(`setupApp - appConfigPath: ${appConfigPath}, dataFilePath: ${dataFilePath}`);
		fs.mkdirSync(appConfigPath, { recursive: true }, (err) => {
			if (err) log.error('Error making appConfigPath', err);
			g.exitAppEarly('Unable to make AppConfig directory');
		});
		fs.mkdirSync(dataFilePath, { recursive: true }, (err) => {
			if (err) log.error('Error making dataFilePath', err)
			g.exitAppEarly('Unable to make Data directory');
		});
		g.Globals.appConfig = await files.readJsonFile(appConfigPath + appConfigFilename);
		if (g.Globals.appConfig == null) {
			await loadInitialConfig();
			// log.verbose(JSON.stringify(g.Globals.appConfig));
		};
		// log.verbose(`Consume Topic: ${g.Globals.invConsumeTopic}`);
		files.readAllJsonFiles(dataFilePath, itemFileNameSuffix, pushInvUpdatedEventCallback);
	} catch (err) {
		log.error('Error in setupApp', err);
	}
};

/**
 * Write inital config if none was found
 */
async function loadInitialConfig() {
	try {
		// log.verbose('loadInitialConfig');
		g.Globals.appConfig = defaultConfig;
		await writeAppConfig();
		addRemoveShoppingList([]);
	} catch (err) {
		log.error('Error in loadInitialConfig', err);
	}
};

/**
 * Save app config to disk
 */
const writeAppConfig = async () => {
	try {
		// log.verbose('writeAppConfig');
		await files.writeJsonFile(appConfigPath + appConfigFilename, g.Globals.appConfig);
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
function getFileName(number) {
	return dataFilePath + number + itemFileNameSuffix;
};

/**
 * Handle all the inventory update logic
 * @param {object} oldItem Old inventory object (or default if new)
 * @param {object} newItem New inventory object
 * @returns Updated inventory object
 */
function updateInvItem(oldItem, newItem) {
	oldItem.CurrentQty = newItem.CurrentQty;
	oldItem.MinQty = newItem.MinQty;
	oldItem.Description = newItem.Description?.trim();
	oldItem.SourceURL = newItem.SourceURL?.trim();
	oldItem.InventoryType = newItem.InventoryType;
	oldItem.Manufacturer = newItem.Manufacturer?.trim();
	oldItem.PartNumber = newItem.PartNumber?.trim();
	oldItem.Location = newItem.Location?.trim();
	oldItem.Category = newItem.Category?.trim();

	if (NotQtyInventoryTypes.includes(newItem.InventoryType)) {
		oldItem.CurrentQty = null;
		oldItem.MinQty = null;
	}

	// log.verbose(oldItem);
	return oldItem;
};
//#endregion

//#region Read/Write Items
/**
 * Read inventory item from data storage
 * @param {string} number Inventory item number
 * @returns Inventory object from storage
 */
async function readInvItem(number) {
	try {
		// log.verbose(`readInvItem ${number}`);
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
 * @param {object} data In-memory inventory object
 */
async function writeInvItem(data) {
	try {
		// log.verbose(`writeInvItem ${data.ItemNumber}`);
		const fullName = getFileName(data.ItemNumber);
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
		// log.verbose('Consuming ' + number);
		const data = await readInvItem(number);
		if (data == null) {
			log.error(`Invalid inventory item consumed: ${number}`);
			return;
		}
		if (data.InventoryType == InventoryType.Piece) {
			data.CurrentQty--;
			await writeInvItem(data);
			await addRemoveShoppingList(data);
		}
		if (data.InventoryType == InventoryType.Bulk) {
			addToShoppingList(data);
		}
	} catch (err) {
		log.error('Error in consumeItem', err);
	} finally {
		pushInvUpdatedEvent();
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
function getNextItemNumber() {
	if (g.Globals.appConfig.ReuseDeletedItemNumbers == true && missingItemNumbers == undefined) {
		return g.Globals.appConfig.NextItemNumber;
	}
	return Math.min(...missingItemNumbers);
}
//#endregion

//#region Shopping List
/**
 * Return the shopping list data
 * @returns Shopping list object array
 */
async function getShoppingList() {
	try {
		return await files.readJsonFile(shoppingListPath);
	} catch {
		return [];
	}
};

/**
 * Update and publish shopping list
 * @param {Array} listData In-memory shopping list array
 */
async function updateShoppingList(listData) {
	await files.writeJsonFile(shoppingListPath, listData);
	await m.publishShoppingList(listData);
};

/**
 * Handle the adding/removing of items of the shopping list
 * @param {object} data Inventory object
 */
async function addRemoveShoppingList(data) {
	if (data.InventoryType === InventoryType.Piece) {
		if (data.CurrentQty <= data.MinQty)
			await addToShoppingList(data);
		else
			await removeIfOnShoppingList(data);
	}
};

/**
 * Internal worker function for the addRemoveShoppingList function
 * @param {object} data Inventory object
 */
async function addToShoppingList(data) {
	try {
		// log.verbose('addToShoppingList');
		let shList = await getShoppingList();
		if (shList != null) {
			const exists = shList.includes(shList.find(l => l.ItemNumber === data.ItemNumber));
			if (!exists)
				shList.push(data);
			else {
				const index = shList.findIndex(l => l.ItemNumber === data.ItemNumber);
				let existing = shList[index];
				existing.CurrentQty = data.CurrentQty;
				shList[index] = existing;
			};
		} else {
			shList = [];
			shList.push(data);
		}
		updateShoppingList(shList);
	} catch (err) {
		log.error('Error in addToShoppingList', err);
	}
}

/**
 * Internal worker function for the addRemoveShoppingList function
 * @param {object} data Inventory object
 * @returns Nothing
 */
async function removeIfOnShoppingList(data) {
	let shList = await getShoppingList();
	if (shList == null)
		return;
	const exists = shList.includes(shList.find(l => l.ItemNumber === data.ItemNumber));
	if (!exists)
		return;
	shList = shList.filter(item => item.ItemNumber !== data.ItemNumber);
	updateShoppingList(shList);
}

const shoppingListJob = schedule.scheduleJob('* * 23 * *', function () {
	getShoppingList();
});
//#endregion

//#region Inventory Updated Event
/**
 * Start the inventory update event. Callback on separate method
 */
function pushInvUpdatedEvent() {
	try {
		// log.verbose('pushInvUpdatedEvent');
		files.readAllJsonFiles(dataFilePath, itemFileNameSuffix, pushInvUpdatedEventCallback);
	} catch (err) {
		log.error('Error in pushInvUpdatedEvent', err);
	}
}

/**
 * Callback method from pushInvUpdatedEvent
 * @param {object} data Inventory object
 * @returns Nothing
 */
function pushInvUpdatedEventCallback(data) {
	// log.verbose('pushInvUpdatedEventCallback');
	if (data === undefined || data === null) {
		log.error(null, 'Unable to pull existing inventory');
		m.publish('Unable to pull existing inventory to update ' + g.Globals.actionResponseTopic, g.Globals.actionResponseTopic, 1, true);
		return;
	}
	// missingItemNumbers = findMissing(data);
	m.publishInvUpdated(data);
	data.map(refreshShoppingList);
	const last = data[data.length - 1];
	g.Globals.appConfig.NextItemNumber = last.ItemNumber + 1;
	writeAppConfig();
}

function refreshShoppingList(data) {
	if (data.InventoryType != 1)
		addRemoveShoppingList(data);
}

// /**
//  * Find missing ItemNumbers in the array
//  * @param {*} data Inventory data array
//  * @returns Array of missing numbers
//  */
// const findMissing = data => {
// 	// Taking this out for now
// 	return [];
// }

const updateJob = schedule.scheduleJob('* * 23 * *', function () {
	pushInvUpdatedEvent();
});
//#endregion

module.exports = {
	setupApp,
	writeAppConfig,
	consumeItem,
	addUpdateItem
};
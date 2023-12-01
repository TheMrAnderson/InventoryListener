const files = require('./helpers/files');
const g = require('./global');
const log = require('./helpers/ca_log');
const m = require('./helpers/mqtt');
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
//#endregion

//#region Config
/**
 * Configure application
 */
const setupApp = async () => {
	try {
		console.log('setupApp');
		appConfigPath = g.Globals.dataFolder + 'config/';
		dataFilePath = g.Globals.dataFolder;
		fs.mkdirSync(appConfigPath, { recursive: true }, (err) => {
			if (err) console.log(err);
			g.exitAppEarly('Unable to make AppConfig directory');
		});
		fs.mkdirSync(dataFilePath, { recursive: true }, (err) => {
			if (err) console.log(err)
			g.exitAppEarly('Unable to make Data directory');
		});
		g.Globals.appConfig = await files.readJsonFile(appConfigPath + appConfigFilename);
		if (g.Globals.appConfig == null) {
			await loadInitialConfig();
			console.log(JSON.stringify(g.Globals.appConfig));
		};
		console.log(JSON.stringify(g.Globals.invConsumeTopic));
		files.readAllJsonFiles(dataFilePath, itemFileNameSuffix, pushInvUpdatedEventCallback);
	} catch (err) {
		console.log(err);
	}
};

/**
 * Write inital config if none was found
 */
async function loadInitialConfig() {
	try {
		console.log('loadInitialConfig');
		g.Globals.appConfig = defaultConfig;
		await writeAppConfig();
	} catch (err) {
		log.error(err);
	}
};

/**
 * Save app config to disk
 */
const writeAppConfig = async () => {
	try {
		console.log('writeAppConfig');
		await files.writeJsonFile(appConfigPath + appConfigFilename, g.Globals.appConfig);
	} catch (err) {
		log.error(err);
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
	console.log('updateInvItem');
	oldItem.CurrentQty = newItem.CurrentQty;
	oldItem.MinQty = newItem.MinQty;
	oldItem.Description = newItem.Description.trim();
	oldItem.SourceURL = newItem.SourceURL.trim();
	oldItem.InventoryType = newItem.InventoryType;
	oldItem.Manufacturer = newItem.Manufacturer.trim();
	oldItem.PartNumber = newItem.PartNumber.trim();
	oldItem.Location = newItem.Location.trim();
	console.log('About to set category');
	oldItem.Category = newItem.Category.trim();
	console.log('Category set');

	if (NotQtyInventoryTypes.includes(newItem.InventoryType)) {
		oldItem.CurrentQty = null;
		oldItem.MinQty = null;
	}

	console.log(oldItem);
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
		console.log(`readInvItem ${number}`);
		const fullName = getFileName(number);
		const data = await files.readJsonFile(fullName);
		if (data == null) {
			console.log(`Asked to read item that doesn't exist: ${number}`);
			return null;
		}
		return data;
	} catch (err) {
		log.error(err, `Error reading item ${number}`);
	}
};

/**
 * Save inventory object to storage
 * @param {object} data In-memory inventory object
 */
async function writeInvItem(data) {
	try {
		console.log(`writeInvItem ${data.ItemNumber}`);
		const fullName = getFileName(data.ItemNumber);
		await files.writeJsonFile(fullName, data);
	} catch (err) {
		log.err(err, `Error writing item ${number}`);
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
		log.verbose('Consuming ' + number);
		const data = await readInvItem(number);
		if (data == null) {
			console.log(`Invalid inventory item consumed: ${number}`);
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
		log.error(err);
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
			else if (existing == null && data.ItemNumber === g.Globals.appConfig.NextItemNumber) {
				// Existing not found BUT it's the next item number anyway
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
	const fullName = `${dataFilePath}shoppingList.json`;
	return await files.readJsonFile(fullName);
};

/**
 * Update and publish shopping list
 * @param {Array} listData In-memory shopping list array
 */
async function updateShoppingList(listData) {
	const fullName = `${dataFilePath}shoppingList.json`;
	await files.writeJsonFile(fullName, listData);
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
		console.log('addToShoppingList');
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
			shList = new Array();
			shList.push(data);
		}
		updateShoppingList(shList);
	} catch (err) {
		log.error(err);
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
		console.log('pushInvUpdatedEvent');
		files.readAllJsonFiles(dataFilePath, itemFileNameSuffix, pushInvUpdatedEventCallback);
	} catch (err) {
		log.error(err);
	}
}

/**
 * Callback method from pushInvUpdatedEvent
 * @param {object} data Inventory object
 * @returns Nothing
 */
function pushInvUpdatedEventCallback(data) {
	console.log('pushInvUpdatedEventCallback');
	if (data === undefined || data === null) {
		log.error(null, 'Unable to pull existing inventory');
		m.publish('Unable to pull existing inventory to update ' + g.Globals.actionResponseTopic, g.Globals.actionResponseTopic, 1, true);
		return;
	}
	missingItemNumbers = findMissing(data);

	m.publishInvUpdated(data);
	const last = data[data.length - 1];
	g.Globals.appConfig.NextItemNumber = last.ItemNumber + 1;
	writeAppConfig();
}

/**
 * Find missing ItemNumbers in the array
 * @param {*} data Inventory data array
 * @returns Array of missing numbers
 */
const findMissing = data => {
	const max = Math.max(...data.ItemNumber); // Will find highest number
	const min = Math.min(...data.ItemNumber); // Will find lowest number
	const missing = [];

	for (let i = min; i <= max; i++) {
		if (!data.ItemNumber.includes(i)) { // Checking whether i(current value) present in num(argument)
			missing.push(i); // Adding numbers which are not in num(argument) array
		}
	}
	return missing;
}

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
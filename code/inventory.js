const files = require('./helpers/files')
const g = require('./global')
const log = require('./helpers/ca_log')
const m = require('./helpers/mqtt')
const fs = require('fs')

//#region Types and const
const InventoryType = {
	Piece: 0,
	Bulk: 1
}

const defaultItem = {
	"ItemNumber": undefined,
	"CurrentQty": 0,
	"Config":
	{
		"SourceURL": "",
		"InventoryType": 0,
		"MinQty": 0,
		"Description": "",
		"Location": ""
	}
}

const defaultConfig = {
	StartingItemNumber: 1000,
	NextItemNumber: 1000
}

const appConfigFilename = 'appconfig.json'
const itemFileNameSuffix = '_item.json'

let appConfigPath
let dataFilePath
//#endregion

//#region Config
const setupApp = async () => {
	try {
		console.log('setupApp')
		appConfigPath = g.Globals.dataFolder + 'config/'
		dataFilePath = g.Globals.dataFolder
		fs.mkdirSync(appConfigPath, { recursive: true }, (err) => {
			if (err) console.log(err)
			g.exitAppEarly('Unable to make AppConfig directory')
		})
		fs.mkdirSync(dataFilePath, { recursive: true }, (err) => {
			if (err) console.log(err)
			g.exitAppEarly('Unable to make Data directory')
		})
		g.Globals.appConfig = await files.readJsonFile(appConfigPath + appConfigFilename)
		if (g.Globals.appConfig == null) {
			await loadInitialConfig()
			console.log(JSON.stringify(g.Globals.appConfig))
		}
		console.log(JSON.stringify(g.Globals.invConsumeTopic))
		files.readAllJsonFiles(dataFilePath, itemFileNameSuffix, pushInvUpdatedEventCallback)
	} catch (err) {
		console.log(err)
	}
}

async function loadInitialConfig() {
	try {
		console.log('loadInitialConfig')
		g.Globals.appConfig = defaultConfig
		await writeAppConfig()
	} catch (err) {
		log.error(err)
	}
}

const writeAppConfig = async () => {
	try {
		console.log('writeAppConfig')
		await files.writeJsonFile(appConfigPath + appConfigFilename, g.Globals.appConfig)
	} catch (err) {
		log.error(err)
	}
}
//#endregion

//#region Helper Methods
function getFileName(number) {
	return dataFilePath + number + itemFileNameSuffix
}

function updateInvItem(oldItem, newItem) {
	oldItem.CurrentQty = newItem.CurrentQty
	oldItem.Config.SourceURL = newItem.Config.SourceURL
	oldItem.Config.InventoryType = newItem.Config.InventoryType
	oldItem.Config.MinQty = newItem.Config.MinQty
	oldItem.Config.Description = newItem.Config.Description
	oldItem.Config.Location = newItem.Config.Location
	return oldItem
}
//#endregion

//#region Read/Write Items
async function readInvItem(number) {
	try {
		console.log(`readInvItem ${number}`)
		const fullName = getFileName(number)
		const data = await files.readJsonFile(fullName)
		if (data == null) {
			console.log(`Asked to read item that doesn't exist: ${number}`)
			return null
		}
		return data
	} catch (err) {
		log.error(err, `Error reading item ${number}`)
	}
}

async function writeInvItem(data) {
	try {
		console.log(`writeInvItem ${data.ItemNumber}`)
		const fullName = getFileName(data.ItemNumber)
		await files.writeJsonFile(fullName, data)
	} catch (err) {
		log.err(err, `Error writing item ${number}`)
	}
}
//#endregion

//#region Consume Event
const consumeItem = async (number) => {
	try {
		log.verbose('Consuming ' + number)
		const data = await readInvItem(number)
		if (data == null) {
			console.log(`Invalid inventory item consumed: ${number}`)
			return
		}
		if (data.Config.InventoryType == InventoryType.Piece) {
			data.CurrentQty--
			await writeInvItem(data)
			await addRemoveShoppingList(data)
		}
		if (data.Config.InventoryType == InventoryType.Bulk) {
			addToShoppingList(data)
		}
	} catch (err) {
		log.error(err)
	} finally {
		pushInvUpdatedEvent()
	}
}
//#endregion

//#region Add/Update Event
const addUpdateItem = async (data) => {
	try {
		let updatedItem
		if (data.ItemNumber == null || data.ItemNumber == undefined) {
			// No item number in payload or null
			updatedItem = updateInvItem(defaultItem, data)
			updatedItem.ItemNumber = g.Globals.appConfig.NextItemNumber

		} else {
			// Item number was included in payload
			existing = await readInvItem(data.ItemNumber)
			if (existing != null) {
				// Existing item found
				updatedItem = updateInvItem(existing, data)
			}
			else if (existing == null && data.ItemNumber === g.Globals.appConfig.NextItemNumber) {
				// Existing not found BUT it's the next item number anyway
				updatedItem = updateInvItem(defaultItem, data)
				updatedItem.ItemNumber = data.ItemNumber
			}
		}
		await writeInvItem(updatedItem)
		await addRemoveShoppingList(updatedItem)
		return
	} catch (err) {
		log.error(err, `Error adding/updating item`)
	} finally {
		pushInvUpdatedEvent()
	}
}
//#endregion

//#region Shopping List
async function getShoppingList() {
	const fullName = `${dataFilePath}shoppingList.json`
	return await files.readJsonFile(fullName)
}

async function updateShoppingList(listData) {
	const fullName = `${dataFilePath}shoppingList.json`
	await files.writeJsonFile(fullName, listData)
	await m.publishShoppingList(listData)
}

async function addRemoveShoppingList(data) {
	if (data.Config.InventoryType === InventoryType.Piece) {
		if (data.CurrentQty <= data.Config.MinQty)
			await addToShoppingList(data)
		else
			await removeIfOnShoppingList(data)
	}
}

async function addToShoppingList(data) {
	try {
		console.log('addToShoppingList')
		let shList = await getShoppingList()
		if (shList != null) {
			const exists = shList.includes(shList.find(l => l.ItemNumber === data.ItemNumber))
			if (!exists)
				shList.push(data)
			else {
				const index = shList.findIndex(l => l.ItemNumber === data.ItemNumber)
				let existing = shList[index]
				existing.CurrentQty = data.CurrentQty
				shList[index] = existing
			}
		} else {
			shList = new Array()
			shList.push(data)
		}
		updateShoppingList(shList)
	} catch (err) {
		log.error(err)
	}
}

async function removeIfOnShoppingList(data) {
	let shList = await getShoppingList()
	if (shList == null)
		return
	const exists = shList.includes(shList.find(l => l.ItemNumber === data.ItemNumber))
	if (!exists)
		return
	shList = shList.filter(item => item.ItemNumber !== data.ItemNumber)
	updateShoppingList(shList)
}
//#endregion

//#region Inventory Updated Event
function pushInvUpdatedEvent() {
	try {
		console.log('pushInvUpdatedEvent')
		files.readAllJsonFiles(dataFilePath, itemFileNameSuffix, pushInvUpdatedEventCallback)
	} catch (err) {
		log.error(err)
	}
}

function pushInvUpdatedEventCallback(data) {
	console.log('pushIngUpdatedEventCallback')
	if (data === undefined || data === null) {
		log.error(null, 'Unable to pull existing inventory')
		m.publish('Unable to pull existing inventory to update ' + g.Globals.actionResponseTopic, g.Globals.actionResponseTopic, 1, true)
		return
	}
	m.publishInvUpdated(data)
	const last = data[data.length - 1]
	g.Globals.appConfig.NextItemNumber = last.ItemNumber + 1
	writeAppConfig()
}
//#endregion

module.exports = {
	setupApp,
	writeAppConfig,
	consumeItem,
	addUpdateItem
}
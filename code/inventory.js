const files = require('./helpers/files')
const g = require('./global')
const log = require('./helpers/ca_log')
const m = require('./helpers/mqtt')
const fs = require('fs')

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
		"MinAmount": 0,
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
			g.Globals.appConfig = loadInitialConfig()
		}
		m.connect()
	} catch (err) {
		log.error(err)
	}
}

async function loadInitialConfig() {
	try {
		console.log('loadInitialConfig')
		g.Globals.appConfig = defaultConfig
		await writeAppConfig()
		return config
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

function getFileName(number) {
	return dataFilePath + number + itemFileNameSuffix
}

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

const consumeItem = async (number) => {
	try {
		console.log('consumeItem ' + number)
		log.verbose('Consuming ' + number)
		const data = await readInvItem(number)
		if (data == null) {
			console.log(`Invalid inventory item consumed: ${number}`)
			return
		}
		if (data.Config.InventoryType == InventoryType.Piece) {
			data.CurrentQty--
			await writeInvItem(data)
			if (data.CurrentQty <= data.Config.MinAmount)
				addToShoppingList(data)
			return
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

function updateInvItem(oldItem, newItem) {
	oldItem.CurrentQty = newItem.CurrentQty
	oldItem.Config.SourceURL = newItem.Config.SourceURL
	oldItem.Config.InventoryType = newItem.Config.InventoryType
	oldItem.Config.MinAmount = newItem.Config.MinAmount
	oldItem.Config.Description = newItem.Config.Description
	oldItem.Config.Location = newItem.Config.Location
	return oldItem
}

const addUpdateItem = async (data) => {
	try {
		let updatedItem
		if (data.ItemNumber == null || data.ItemNumber == undefined) {
			data.ItemNumber = g.Globals.appConfig.NextItemNumber
			data = loadDefaultItem(data.ItemNumber)
			updatedItem = updateInvItem(defaultItem, data)

		} else {
			existing = await readInvItem(data.ItemNumber)
			updatedItem = updateInvItem(existing, data)
		}
		await writeInvItem(updatedItem)
		return
	} catch (err) {
		log.error(err, `Error adding/updating item`)
	}
}

async function loadDefaultItem(number) {
	try {
		console.log('loadDefaultItem ' + number)
		let fullName = dataFilePath + number + itemFileNameSuffix
		let data = defaultItem
		data.ItemNumber = number
		return data
	} catch (err) {
		log.error(err)
	}
}

async function addToShoppingList(data) {
	try {
		console.log('addToShoppingList')
		let fullName = dataFilePath + 'shoppingList.json'
		let shList = await files.readJsonFile(fullName)
		if (shList != null) {
			let exists = shList.includes(shList.find(l => l.ItemNumber === data.ItemNumber))
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
		updateShoppingList(fullName, shList)
	} catch (err) {
		log.error(err)
	}
}

async function updateShoppingList(fullName, listData) {
	await files.writeJsonFile(fullName, listData)
	await m.publishShoppingList(listData)
}

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
}

module.exports = {
	setupApp,
	writeAppConfig,
	consumeItem,
	addUpdateItem
}
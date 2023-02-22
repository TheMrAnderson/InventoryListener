const files = require('./helpers/files')
const g = require('./global')
const log = require('./helpers/ca_log')
const m = require('./helpers/mqtt')
const fs = require('fs')

const InventoryType = {
	Piece: 0,
	Bulk: 1
}

const appConfigFilename = 'appconfig.json'
const itemFileNameSuffix = '_item.json'

let appConfigPath
let dataFilePath


const readAppConfig = async () => {
	try {
		console.log('readAppConfig')
		appConfigPath = g.Globals.dataFolder + 'config/'
		dataFilePath = g.Globals.dataFolder
		fs.mkdirSync(appConfigPath, { recursive: true }, (err) => {
			if (err) console.log(err)
		})
		fs.mkdirSync(dataFilePath, { recursive: true }, (err) => {
			if (err) console.log(err)
		})
		g.Globals.appConfig = await files.readJsonFile(appConfigPath + appConfigFilename)
		if (g.Globals.appConfig == null) {
			g.Globals.appConfig = loadInitialConfig()
		}
	} catch (err) {
		log.error(err)
	}
}

async function loadInitialConfig() {
	try {
		console.log('loadInitialConfig')
		const config = { StartingItemNumber: 1000 }
		await files.writeJsonFile(appConfigPath + appConfigFilename, config)
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

const consumeItem = async (number) => {
	try {
		console.log('consumeItem ' + number)
		log.verbose('Consuming ' + number)
		let fullName = dataFilePath + number + itemFileNameSuffix
		let data = await files.readJsonFile(fullName)
		if (data == null) {
			return
		}
		if (data.Config.InventoryType == InventoryType.Piece) {
			data.CurrentQty--
			await files.writeJsonFile(fullName, data)
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
		pushInventoryUpdatedEvent()
	}
}

const addUpdateItem = (data) => {

}

async function loadDefaultItem(number) {
	try {
		console.log('loadDefaultItem ' + number)
		let fullName = dataFilePath + number + itemFileNameSuffix
		const data = { "ItemNumber": number, "CurrentQty": 0, "Config": { "SourceURL": "", "InventoryType": 0, "MinAmount": 0, "Description": "", "Location": "" } }
		await files.writeJsonFile(fullName, data)
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
			else
				return
		} else {
			shList = new Array()
			shList.push(data)
		}
		await files.writeJsonFile(fullName, shList)
	} catch (err) {
		log.error(err)
	}
}

function pushInventoryUpdatedEvent() {
	try {
		console.log('pushInventoryUpdatedEvent')
		files.readAllJsonFiles(dataFilePath, itemFileNameSuffix, pushInvUpdatedEventCallback)
	} catch (err) {
		log.error(err)
	}
}

function pushInvUpdatedEventCallback(data) {
	if (data === undefined || data === null) {
		log.error(null, 'Unable to pull existing inventory')
		m.publish('Unable to pull existing inventory to update ' + g.Globals.actionResponseTopic, g.Globals.actionResponseTopic, 1, true)
		return
	}
	dString = JSON.stringify(data)
	m.publish(dString, g.Globals.invUpdatedTopic, 2, true)
}

module.exports = {
	readAppConfig,
	writeAppConfig,
	consumeItem,
	addUpdateItem
}
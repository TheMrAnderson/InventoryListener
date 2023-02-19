const files = require('./helpers/files')
const g = require('./global')
const log = require('./helpers/ca_log')
const fs = require('fs')

const InventoryType = {
	Piece: 0,
	Bulk: 1
}

const appConfigPath = '.inventory/config/'
const dataFilePath = '.inventory/data/'
const appConfigFilename = 'appconfig.json'
const itemFileNameSuffix = '.json'

const readAppConfig = async () => {
	try {
		fs.mkdirSync(appConfigPath, { recursive: true }, (err) => {
			if (err) console.log(err)
		})
		fs.mkdirSync(dataFilePath, { recursive: true }, (err) => {
			if (err) console.log(err)
		})
		g.appConfig = await files.readJsonFile(appConfigPath + appConfigFilename)
		if (g.appConfig == null) {
			g.appConfig = loadInitialConfig()
		}
	} catch (err) {
		log.error(err)
	}
}

async function loadInitialConfig() {
	try {
		const config = { StartingItemNumber: 1000 }
		await files.writeJsonFile(appConfigPath + appConfigFilename, config)
		return config
	} catch (err) {
		log.error(err)
	}
}

const writeAppConfig = async () => {
	try {
		await files.writeJsonFile(appConfigPath + appConfigFilename, g.appConfig)
	} catch (err) {
		log.error(err)
	}
}

const consumeItem = async (number) => {
	try {
		let fullName = dataFilePath + number + itemFileNameSuffix
		let data = await files.readJsonFile(fullName)
		if (data == null) {
			loadDefaultItem(number)
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
	}
}

async function loadDefaultItem(number) {
	try {
		let fullName = dataFilePath + number + itemFileNameSuffix
		const data = { "ItemNumber": number, "CurrentQty": 0, "Config": { "SourceURL": "", "InventoryType": 0, "MinAmount": 0, "Description": "", "Location": "" } }
		await files.writeJsonFile(fullName, data)
	} catch (err) {
		log.error(err)
	}
}

async function addToShoppingList(data) {
	try {
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

module.exports = {
	readAppConfig,
	writeAppConfig,
	consumeItem
}
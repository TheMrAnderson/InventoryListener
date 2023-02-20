const fs = require('fs/promises')
const log = require('./ca_log')

let defaultEncoding = 'utf8'

const readFile = async (fileName) => {
	try {
		const raw = await fs.readFile(fileName, { encoding: defaultEncoding })
		return raw
	} catch (err) {
		log.error(err)
		return null
	}
}

const readAllFiles = async (directory) => {
	try {
		let invList = new Array()
		await fs.readdir(directory, async (err, files) => {
			for (const file of files) {
				const raw = await readFile(file)
				invList.push(raw)
			}
		})
	} catch (err) {
		log.error(err)
		return null
	}
}

const writeFile = async (filename, content) => {
	try {
		await fs.writeFile(filename, content, { encoding: defaultEncoding, flag: 'w' })
	} catch (err) {
		log.error(err)
	}
}

const appendToFile = async (filename, content) => {
	try {
		await fs.appendFile(filename, content, { encoding: defaultEncoding })
	} catch (err) {
		log.error(err)
	}
}

const readJsonFile = async (filename) => {
	try {
		let raw = await readFile(filename)
		if (raw != null) {
			return JSON.parse(raw)
		}
		return raw
	} catch (err) {
		log.error(err)
	}
}

const writeJsonFile = async (filename, object) => {
	try {
		let jsonString = JSON.stringify(object, null, 2)
		return await writeFile(filename, jsonString);
	} catch (err) {
		log.error(err)
	}
}

const readAllJsonFiles = async (directory) => {
	try {
		let invList = new Array()
		await fs.readdir(directory, async (err, files) => {
			for (const file of files) {
				const data = await readJsonFile(file)
				invList.push(data)
			}
		})
	} catch (err) {
		log.error(err)
		return null
	}
}

module.exports = {
	readJsonFile,
	writeJsonFile
}
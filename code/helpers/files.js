const fs = require('fs/promises')
const log = require('./ca_log')

let defaultEncoding = 'utf8'

//#region Read
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

const readAllJsonFiles = (directory, fileFilter, callback) => {
	try {
		let invList = new Array()
		const dir = directory
		fs.readdir(directory)
			.then(async files => {
				for (const file of files) {
					if (file.includes(fileFilter)) {
						const data = await readJsonFile(dir + file)
						invList.push(data)
					}
				}
				return callback(invList)
			})
			.catch(err => {
				log.error(err)
				return null
			})
	} catch (err) {
		log.error(err)
		return null
	}
}
//#endregion

//#region Write
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

const writeJsonFile = async (filename, object) => {
	try {
		let jsonString = JSON.stringify(object, null, 2)
		return await writeFile(filename, jsonString);
	} catch (err) {
		log.error(err)
	}
}
//#endregion

module.exports = {
	readJsonFile,
	writeJsonFile,
	readAllJsonFiles
}
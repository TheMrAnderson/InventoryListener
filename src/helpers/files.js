const fs = require('fs/promises')
const log = require('./ca_log')

let defaultEncoding = 'utf8'

//#region Read
const readFile = async (fileName) => {
	try {
		const raw = await fs.readFile(fileName, { encoding: defaultEncoding })
		return raw
	} catch (err) {
		log.error(`Error in readFile - filename ${fileName}`, err)
		return null
	}
}

const readJsonFile = async (fullFilePath) => {
	try {
		let raw = await readFile(fullFilePath)
		if (raw != null) {
			return JSON.parse(raw)
		}
		return raw
	} catch (err) {
		log.error(`Error in readJsonFile - filepath ${fullFilePath}`, err)
	}
}

/**
 *
 * @param {string} directory Directory to read all files from
 * @param {*} fileHandlingMethod Method to work with each file, parameters returned are (file, file's data in JSON)
 * @returns
 */
const readAllJsonFiles = async (directory, fileHandlingMethod) => {
	try {
		const files = await fs.readdir(directory);
		for (const file of files) {
			const fullFilename = directory + file;
			const d = await readJsonFile(fullFilename);
			fileHandlingMethod(fullFilename, d);
		}
	} catch (err) {
		log.error(`Error in readAllJsonFiles - directory ${directory}`, err)
		return null
	}
}
//#endregion

//#region Write
const writeFile = async (filename, content) => {
	try {
		await fs.writeFile(filename, content, { encoding: defaultEncoding, flag: 'w' });
	} catch (err) {
		log.error(`Error in writeFile - filename ${filename}`, err);
	}
}

const writeJsonFile = async (filename, object) => {
	try {
		let jsonString = JSON.stringify(object, null, 2);
		return await writeFile(filename, jsonString);
	} catch (err) {
		log.error(`Error in writeJsonFile - filename ${filename}`, err);
	}
}
//#endregion

module.exports = {
	readJsonFile,
	writeJsonFile,
	readAllJsonFiles
};
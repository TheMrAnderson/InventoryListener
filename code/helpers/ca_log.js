const g = require('../global')
const m = require('./mqtt')

const error = async (err, message) => {
	try {
		console.log(createLogObject(message, err))
		await sendData(createLogObject(message, err))
	} catch (err) {
		console.log(err)
	}
}

const verbose = async (message) => {
	try {
		await sendData(createLogObject(message, null))
	} catch (err) {
		console.log(err)
	}
}

function createLogObject(message, err) {
	let obj =
	{
		Source: 'CA Inventory Listener',
		EventTime: new Date().toISOString(),
		Message: message,
		Error: err
	}
	let objString = JSON.stringify(obj, null, 2)
	return objString
}

async function sendData(objString) {
	m.publish(objString, g.Globals.logTopic)
}

module.exports = {
	verbose,
	error
}
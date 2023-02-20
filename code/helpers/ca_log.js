const g = require('../global')
const mqtt = require('mqtt')

const error = async (err, message) => {
	try {
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
	let obj = { Source: 'CA Inventory Listener', EventTime: new Date().toISOString(), Message: message, Error: err }
	let objString = JSON.stringify(obj, null, 2)
	return objString
}

async function sendData(objString) {
	try {
		g.mqttClient.publish(g.logTopic, objString, function (err) {
			if (err) {
				console.log(err)
			}
		})
	} catch (err) {
		console.log('Error sending to MQTT server')
		console.log(objString)
		console.log(err)
	}
}

module.exports = {
	verbose,
	error
}
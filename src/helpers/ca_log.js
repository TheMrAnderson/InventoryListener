const g = require('../global');
const m = require('./mqtt_publish');

const error = async (message, err) => {
	try {
		await sendData(createLogObject(message, err, 'Error'));
	} catch (err) {
		console.log('Error in ca_log.error', err);
	}
}

const verbose = async (message) => {
	try {
		await sendData(createLogObject(message, null, 'Verbose'));
	} catch (err) {
		console.log('Error in ca_log.verbose', err);
	}
}

function createLogObject(message, err, logType) {
	const obj =
	{
		Source: 'CA Inventory Listener',
		EventTime: new Date().toISOString(),
		Message: message,
		Error: err,
		LogType: logType
	};
	let objString = JSON.stringify(obj, null, 2);
	return objString;
}

async function sendData(objString) {
	logToConsole(objString);
	if (g.Globals.mqttClient !== undefined)
		m.publish(objString, g.Globals.logTopic);
}

function logToConsole(message) {
	console.log(message);
}

module.exports = {
	verbose,
	error
};
const g = require('../global');
const m = require('./mqtt_publish');

const trace = async (message, data) => {
	try {
		await logHelper(message, null, data, 'Trace');
	} catch (err) {
		console.log('Error in ca_log.trace', err);
	}
}

const debug = async (message, data) => {
	try {
		await logHelper(message, null, data, 'Debug');
	} catch (err) {
		console.log('Error in ca_log.verbose', err);
	}
}

const verbose = async (message, data) => {
	try {
		await logHelper(message, null, data, 'Verbose');
	} catch (err) {
		console.log('Error in ca_log.verbose', err);
	}
}

const error = async (message, err, data) => {
	try {
		await logHelper(message, err, data, 'Error');
	} catch (err) {
		console.log('Error in ca_log.error', err);
	}
}

const logHelper = async (message, err, data, level) => {
	if (!shouldLog(level))
		return;
	await sendData(createLogObject(message, err, level, data));
}

function shouldLog(level) {
	if (g.Globals.logLevel.includes('*'))
		return true;
	if (g.Globals.logLevel.includes(level))
		return true;
	if (level === 'Error')
		return true;
	if (level === 'Verbose' && g.Globals.logLevel.includes('Debug'))
		return true; // Debug should also log verbose logs, even if the setup didn't specifically call for it
	return false;
}

function createLogObject(message, err, logType, data) {
	const obj =
	{
		Source: 'CA Inventory Listener',
		EventTime: new Date().toISOString(),
		Message: message,
		Error: err,
		LogType: logType,
		Data: JSON.stringify(data)
	};
	let objString = JSON.stringify(obj, jsonReplacer, 2);
	return objString;
}

function jsonReplacer(key, value) {
	// Filtering out properties
	if (value === null) {
		return undefined;
	}
	return value;
}

async function sendData(objString) {
	logToConsole(objString);
	if (g.Globals.mqttClient !== undefined)
		m.publish(objString, g.Globals.logTopic);
}

function logToConsole(message) {
	console.log(message);
}

// Logging Levels
// Trace - most fine grained
// Debug - very detailed
// Verbose
// Error

module.exports = {
	trace,
	debug,
	verbose,
	error
};
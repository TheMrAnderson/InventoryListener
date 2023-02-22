const p = require('node:process')

var Globals = {
	appConfig: undefined,
	mqttClient: undefined,
	dataFolder: undefined,
	logTopic: undefined,
	invConsumeTopic: undefined,
	invUpdatedTopic: undefined,
	addUpdateItemTopic: undefined,
	actionResponseTopic: undefined,
	mqttServerAddress: undefined
}

const validateConfig = async () => {
	let msg = ''
	if (Globals.dataFolder === undefined)
		msg += 'Data folder not specified. '
	if (Globals.logTopic === undefined)
		msg += 'Log topic not specified. '
	if (Globals.invConsumeTopic === undefined)
		msg += 'Inventory consume topic not specified. '
	if (Globals.invUpdatedTopic === undefined)
		msg += 'Inventory updated topic not specified. '
	if (Globals.addUpdateItemTopic === undefined)
		msg += 'Add/Update topic not specified. '
	if (Globals.actionResponseTopic === undefined)
		msg += 'Action response topic not specified. '
	if (Globals.mqttServerAddress === undefined)
		msg += 'MQTT server address not specified. '

	if (msg === '')
		return
	console.log(msg + 'Exiting application')
	p.exitCode = 9
	p.kill(p.pid, "SIGTERM")
}

module.exports = {
	validateConfig,
	Globals
}
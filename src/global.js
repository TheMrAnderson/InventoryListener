const p = require('node:process');

var Globals = {
	appConfig: undefined,
	mqttClient: undefined,
	dataFolder: undefined,
	logTopic: undefined,
	invConsumeTopic: undefined,
	invUpdatedTopic: undefined,
	addUpdateItemTopic: undefined,
	actionResponseTopic: undefined,
	shoppingListTopic: undefined,
	mqttServerAddress: undefined,
	invDataList: undefined
};

const validateConfig = () => {
	let msg = '';
	if (Globals.dataFolder === undefined)
		msg += 'Data folder not specified. ';
	if (Globals.logTopic === undefined)
		msg += 'Log topic not specified. ';
	if (Globals.invConsumeTopic === undefined)
		msg += 'Inventory consume topic not specified. ';
	if (Globals.invUpdatedTopic === undefined)
		msg += 'Inventory updated topic not specified. ';
	if (Globals.addUpdateItemTopic === undefined)
		msg += 'Add/Update topic not specified. ';
	if (Globals.actionResponseTopic === undefined)
		msg += 'Action response topic not specified. ';
	if (Globals.mqttServerAddress === undefined)
		msg += 'MQTT server address not specified. ';
	if (Globals.shoppingListTopic === undefined)
		msg += 'Shopping list topic not specified. ';

	if (msg === '')
		return;
	exitAppEarly(msg);
};

const exitAppEarly = (reason) => {
	console.log(`Exiting application. ${reason}`);
	p.exitCode = 9;
	p.kill(p.pid, "SIGTERM");
};

module.exports = {
	validateConfig,
	exitAppEarly,
	Globals
};
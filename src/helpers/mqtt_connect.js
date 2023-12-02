const log = require('../helpers/ca_log');
const g = require('../global');
require('dotenv').config();

function onMqttConnect() {
	const opt = { qos: 2, retain: true };
	g.Globals.mqttClient.subscribe(g.Globals.invConsumeTopic, opt, function (err) {
		if (err) {
			log.error('Error subscribing to inventory consume topic', err)
		}
	});

	g.Globals.mqttClient.subscribe(g.Globals.addUpdateItemTopic, opt, function (err) {
		if (err) {
			log.error('Error subscribing to add update topic', err);
		}
	});

	log.verbose('App online and listening for events');
}


module.exports = {
	onMqttConnect
};
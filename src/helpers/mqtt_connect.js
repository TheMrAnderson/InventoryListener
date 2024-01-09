const log = require('../helpers/ca_log');
const g = require('../global');
require('dotenv').config();

const onMqttConnect = () => {
	const opt = { qos: 2, retain: true };
	g.Globals.mqttClient.subscribe(g.Globals.invConsumeTopic, opt, function (err) {
		if (err) {
			const msg = `Error subscribing to inventory consume topic ${g.Globals.invConsumeTopic}`
			log.error(msg, err);
			g.exitAppEarly(msg);
		}
	});

	g.Globals.mqttClient.subscribe(g.Globals.addUpdateItemTopic, opt, function (err) {
		if (err) {
			const msg = `Error subscribing to add update topic ${g.Globals.addUpdateItemTopic}`
			log.error(msg, err);
			g.exitAppEarly(msg);
			return;
		}
	});

	log.verbose('App online and listening for events');
}


module.exports = {
	onMqttConnect
};
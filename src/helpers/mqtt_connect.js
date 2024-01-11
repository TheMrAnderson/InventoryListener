const log = require('../helpers/ca_log');
const g = require('../global');
require('dotenv').config();

const onMqttConnect = (connack) => {
	log.verbose(`MQTT Connect - connack ${connack}`);
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

const onMqttReconnect = () => {
	log.verbose('MQTT Connection Reconnected');
}

const onMqttClose = () => {
	log.verbose('MQTT Connection Closed');
}

const onMqttDisconnect = (packet) => {
	log.verbose(`MQTT Connection Disconnected - packet ${packet}`);
}

const onMqttOffline = () => {
	log.verbose('MQTT Client Offline');
}

const onMqttError = (err) => {
	log.error('MQTT Error', err)
}


module.exports = {
	onMqttConnect,
	onMqttReconnect,
	onMqttClose,
	onMqttDisconnect,
	onMqttOffline,
	onMqttError
};
const g = require('../global');
require('dotenv').config();
const inventory = require('../inventory')

function onMqttMessage(topic, message, packet) {
	let obj;
	if (packet.topic != null) {
		const stringBuf = packet.payload.toString('utf8');
		if (stringBuf.length == 0)
			return;
		obj = JSON.parse(stringBuf);
	}

	if (topic === g.Globals.invConsumeTopic)
		inventory.consumeItem(obj);

	if (topic === g.Globals.addUpdateItemTopic)
		inventory.addUpdateItem(obj);
}

module.exports = {
	onMqttMessage
}
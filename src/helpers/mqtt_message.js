const g = require('../global');
const log = require('../helpers/ca_log');
require('dotenv').config();
const inventory = require('../inventory')

const onMqttMessage = (topic, message, packet) => {
	let obj;
	log.debug('onMqttMessage', packet);
	if (packet.topic != null) {
		const stringBuf = packet.payload.toString('utf8');
		if (stringBuf.length == 0)
			return;
		obj = JSON.parse(stringBuf);
	}

	if (topic === g.Globals.invConsumeTopic) {
		if (typeof (obj) === "number") {
			inventory.consumeItem(obj);
		} else {
			log.error('Consume message incorrect', 'Data is not a number', obj);
		}
	}

	if (topic === g.Globals.addUpdateItemTopic)
		inventory.addUpdateItem(obj);

	if (topic === g.Globals.shoppingListTopic)
		inventory.externalShoppingListUpdate(obj);
}

module.exports = {
	onMqttMessage
}
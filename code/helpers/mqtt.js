const g = require('../global')

const publish = async (data, topic, qos = 0, retain = false) => {
	try {
		const opt = { qos: qos, retain: retain }
		g.Globals.mqttClient.publish(topic, data, opt, function (err) {
			if (err) {
				console.log(err)
			}
		})
	}
	catch (err) {
		console.log('Error publishing MQTT message to topic')
		console.log(err)
	}
}

const publishInvUpdated = async (data) => {
	dString = JSON.stringify(data)
	await publish(dString, g.Globals.invUpdatedTopic, 1, true)
}

const publishShoppingList = async (data) => {
	dString = JSON.stringify(data)
	await publish(dString, g.Globals.shoppingListTopic, 1, true)
}

module.exports = {
	publish,
	publishInvUpdated,
	publishShoppingList
}
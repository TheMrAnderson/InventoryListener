const g = require('../global')
const mqtt = require('mqtt')

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

module.exports = {
	publish
}
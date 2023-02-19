const process = require('node:process')
const mqtt = require('mqtt')
const log = require('./code/helpers/ca_log')
const g = require('./code/global')
const inventory = require('./code/inventory')

// Begin reading from stdin so the process does not exit
process.stdin.resume()

// https://github.com/mqttjs/MQTT.js
g.mqttClient = mqtt.connect('mqtt://172.30.62.2')
let topic = 'inventory/consume'
inventory.readAppConfig();

log.verbose('App Started')

g.mqttClient.on('connect', function () {
	g.mqttClient.subscribe(topic, function (err) {
		if (err) {
			log.error(err, 'Error connecting to inventory consume topic')
		}
	})
})

g.mqttClient.on('message', function (topic, message) {
	inventory.consumeItem(message.toString())
})


// Close the client when the app is closing
process.on('SIGTERM', () => {
	log.verbose('App Ended')
	g.mqttClient.end()
})
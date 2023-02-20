const p = require('node:process')
const mqtt = require('mqtt')
const log = require('./code/helpers/ca_log')
const g = require('./code/global')
const inventory = require('./code/inventory')
require('dotenv').config()


// Begin reading from stdin so the process does not exit
p.stdin.resume()

// Read environment variables
g.dataFolder = process.env.DATAFOLDER || '/data/'
g.logTopic = process.env.LOGTOPIC || 'logs'
g.inventoryConsumeTopic = process.env.INVENTORYCONSUMETOPIC || 'inventory/consume'
g.mqttServerAddress = process.env.MQTTSERVERADDRESS

// https://github.com/mqttjs/MQTT.js
g.mqttClient = mqtt.connect(g.mqttServerAddress)
inventory.readAppConfig();

g.mqttClient.on('connect', function () {
	g.mqttClient.subscribe(g.inventoryConsumeTopic, function (err) {
		if (err) {
			log.error(err, 'Error connecting to inventory consume topic')
		}
	})
	log.verbose('App Started')
})

g.mqttClient.on('message', function (topic, message) {
	inventory.consumeItem(message.toString())
})


// Close the client when the app is closing
p.on('SIGTERM', () => {
	log.verbose('App Ended')
	g.mqttClient.end()
})
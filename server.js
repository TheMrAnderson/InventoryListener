const p = require('node:process')
const mqtt = require('mqtt')
const log = require('./code/helpers/ca_log')
const g = require('./code/global')
const inventory = require('./code/inventory')
require('dotenv').config()


// Begin reading from stdin so the process does not exit
p.stdin.resume()

// Read environment variables
global.dataFolder = process.env.DATAFOLDER || '/data/'
global.logTopic = process.env.LOGTOPIC || 'logs'
global.inventoryConsumeTopic = process.env.INVENTORYCONSUMETOPIC || 'inventory/consume'
global.mqttServerAddress = process.env.MQTTSERVERADDRESS

// https://github.com/mqttjs/MQTT.js
g.mqttClient = mqtt.connect(global.mqttServerAddress)
inventory.readAppConfig();

log.verbose('App Started')

g.mqttClient.on('connect', function () {
	g.mqttClient.subscribe(global.inventoryConsumeTopic, function (err) {
		if (err) {
			log.error(err, 'Error connecting to inventory consume topic')
		}
	})
})

g.mqttClient.on('message', function (topic, message) {
	inventory.consumeItem(message.toString())
})


// Close the client when the app is closing
p.on('SIGTERM', () => {
	log.verbose('App Ended')
	g.mqttClient.end()
})
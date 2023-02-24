const p = require('node:process')
const log = require('./code/helpers/ca_log')
const g = require('./code/global')
const inventory = require('./code/inventory')
const mqtt = require('mqtt')
require('dotenv').config()

// Begin reading from stdin so the process does not exit
p.stdin.resume()

// Read environment variables
g.Globals.dataFolder = process.env.DATAFOLDER || '/data/'
g.Globals.logTopic = process.env.LOGTOPIC || 'logs'
g.Globals.invConsumeTopic = process.env.INVENTORYCONSUMETOPIC || 'inventory/consume'
g.Globals.addUpdateItemTopic = process.env.INVENTORYADDUPDATETOPIC || 'inventory/addupdate'
g.Globals.invUpdatedTopic = process.env.INVENTORYUPDATEDTOPIC || 'inventory/updated'
g.Globals.actionResponseTopic = process.env.ACTIONRESPONSETOPIC || 'inventory/actionresponse'
g.Globals.mqttServerAddress = process.env.MQTTSERVERADDRESS
g.validateConfig()
inventory.setupApp();

// https://github.com/mqttjs/MQTT.js
g.Globals.mqttClient = mqtt.connect(g.Globals.mqttServerAddress,
	{
		clientId: `invlistener_${process.env.USERNAME}_${process.env.PWD}`,
		clean: false
	})

g.Globals.mqttClient.on('connect', function () {
	const opt = { qos: 2, retain: true }
	g.Globals.mqttClient.subscribe(g.Globals.invConsumeTopic, opt, function (err) {
		if (err) {
			console.log(err, 'Error subscribing to inventory consume topic')
		}
	})

	g.Globals.mqttClient.subscribe(g.Globals.addUpdateItemTopic, opt, function (err) {
		if (err) {
			console.log(err, 'Error subscribing to add update topic')
		}
	})

	console.log('App online and listening for events')
	log.verbose('App online and listening for events')
})

g.Globals.mqttClient.on('message', function (topic, message, packet) {
	let obj
	if (packet.topic != null) {
		const stringBuf = packet.payload.toString('utf-8')
		if (stringBuf.length == 0)
			return
		obj = JSON.parse(stringBuf)
	}

	if (topic === g.Globals.invConsumeTopic)
		inventory.consumeItem(obj)

	if (topic === g.Globals.addUpdateItemTopic)
		inventory.addUpdateItem(obj)
})

const cleanup = () => {
	log.verbose('App Ended')
	console.log('App Ended')
	g.Globals.mqttClient.end()
}

// Close the client when the app is closing
p.on('SIGTERM', () => {
	cleanup()
})

p.on('SIGINT', () => {
	cleanup()
})
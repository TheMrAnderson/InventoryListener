const p = require('node:process');
const log = require('./src/helpers/ca_log');
const g = require('./src/global');
const inventory = require('./src/inventory');
const mqtt = require('mqtt');
const mqC = require('./src/helpers/mqtt_connect');
const { onMqttMessage } = require('./src/helpers/mqtt_message');
const crypto = require('crypto');
require('dotenv').config();

// Begin reading from stdin so the process does not exit
p.stdin.resume();

// Read environment variables
let args = {
	dataFolder: process.env.DATAFOLDER,
	logTopic: process.env.LOGTOPIC,
	topicFolder: process.env.TOPICFOLDER,
	invConsumeTopic: process.env.INVENTORYCONSUMETOPIC,
	addUpdateItemTopic: process.env.INVENTORYADDUPDATETOPIC,
	invUpdatedTopic: process.env.INVENTORYUPDATEDTOPIC,
	actionResponseTopic: process.env.ACTIONRESPONSETOPIC,
	shoppingListTopic: process.env.SHOPPINGLISTTOPIC,
	mqttServerAddress: process.env.MQTTSERVERADDRESS,
	logLevel: process.env.LOGLEVEL
};

inventory.setupApp(args);

// Create a unique identifier for this instance, then hash it for security purposes
const clientId = `invlistener_${process.env.USERNAME}_${g.Globals.invConsumeTopic}_${g.Globals.dataFolder}`
const clientIdHash = crypto.createHash('sha256').update(clientId).digest('base64');
log.verbose('ClientId', clientIdHash);

g.Globals.mqttClient = mqtt.connect(g.Globals.mqttServerAddress,
	{
		clientId: clientIdHash,
		clean: false,
		reconnectPeriod: 5000,
		SessionExpiryInterval: 0,
		KeepAlive: 30
	});

g.Globals.mqttClient.on('connect', (connack) => mqC.onMqttConnect(connack));
g.Globals.mqttClient.on('reconnect', () => mqC.onMqttReconnect());
g.Globals.mqttClient.on('close', () => mqC.onMqttClose());
g.Globals.mqttClient.on('disconnect', (packet) => mqC.onMqttDisconnect(packet));
g.Globals.mqttClient.on('offline', () => mqC.onMqttOffline());
g.Globals.mqttClient.on('error', (err) => mqC.onMqttError(err));

g.Globals.mqttClient.on('message', (topic, message, packet) => onMqttMessage(topic, message, packet));

const cleanup = () => {
	log.verbose('App Ended');
	g.Globals.mqttClient.end();
}

// Close the client when the app is closing
p.on('SIGTERM', () => {
	cleanup();
})

p.on('SIGINT', () => {
	cleanup();
})
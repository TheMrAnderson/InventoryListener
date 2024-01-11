const p = require('node:process');
const log = require('./src/helpers/ca_log');
const g = require('./src/global');
const inventory = require('./src/inventory');
const mqtt = require('mqtt');
const mqC = require('./src/helpers/mqtt_connect');
const { onMqttMessage } = require('./src/helpers/mqtt_message');
require('dotenv').config();

// Begin reading from stdin so the process does not exit
p.stdin.resume();

// Read environment variables
g.Globals.dataFolder = process.env.DATAFOLDER || '/data/';
g.Globals.logTopic = process.env.LOGTOPIC || 'logs';
const topicFolder = process.env.TOPICFOLDER || 'inventory_ca';
g.Globals.invConsumeTopic = process.env.INVENTORYCONSUMETOPIC || `${topicFolder}/consume`;
g.Globals.addUpdateItemTopic = process.env.INVENTORYADDUPDATETOPIC || `${topicFolder}/addupdate`;
g.Globals.invUpdatedTopic = process.env.INVENTORYUPDATEDTOPIC || `${topicFolder}/updated`;
g.Globals.actionResponseTopic = process.env.ACTIONRESPONSETOPIC || `${topicFolder}/actionresponse`;
g.Globals.shoppingListTopic = process.env.SHOPPINGLISTTOPIC || `${topicFolder}/shoppinglist`;
g.Globals.mqttServerAddress = process.env.MQTTSERVERADDRESS;
g.validateConfig();
inventory.setupApp();

g.Globals.mqttClient = mqtt.connect(g.Globals.mqttServerAddress,
	{
		clientId: `invlistener_${process.env.USERNAME}_${process.env.PWD}`,
		clean: false,
		reconnectPeriod: 5000
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
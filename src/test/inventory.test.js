const inv = require('../inventory');

beforeEach(() => {
	let args = {
		logTopic: 'i/logs',
		dataFolder: './data',
		topicFolder: 'i',
		mqttServerAddress: 'mqtt://test.mosquitto.org',
		logLevel: 'Error'
	};
	inv.setupApp(args);
});


test('adds item to shopping list', () => {
	const data = {
		"ItemNumber": "1",
		"Description": "M8 x 0.8 Cap Head Screw",
		"SourceURL": null,
		"InventoryType": 1,
		"Manufacturer": "ACME",
		"PartNumber": "123ABC",
		"Location": "Metric Tackle Box",
		"Category": "Hardware"
	}
	expect(inv.addToShoppingList(data)).toBe(true);
});
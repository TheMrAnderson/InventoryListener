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
		"InventoryType": 1
	}
	expect(inv.addToShoppingList(data)).toBe(true);
});
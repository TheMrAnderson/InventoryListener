# Inventory Listener

Listen on an MQTT topic for inventory item numbers. Based upon the item configuration either put them directly on the shopping list or only put them on when the threshold is reached

This is the backend part of the Inventory system for ClubAnderson and handles the

## Variables

`LOGTOPIC`: MQTT topic to send the event logs from the app<br/>
`INVENTORYCONSUMETOPIC`: MQTT topic to receive an inventory consume events<br/>
`INVENTORYADDUPDATETOPIC`: MQTT topic to receive an inventory item object to either update if it exists, or add new if it doesn't exit<br/>
`INVENTORYUPDATEDTOPIC`: MQTT topic to send the inventory list. This will be sent with a `retain` flag of true so the most up to date list of the inventory will be waiting on clients. All inventory actions will respond with a full inventory list back to this topic. Any clients should listen to this topic for the lifetime of the app.<br/>
`ACTIONRESPONSETOPIC`: MQTT topic to respond the results of an action. For example if the add/update has issues, a reponse will be sent to this topic for clients to handle.<br/>
`MQTTSERVERADDRESS`: MQTT broker address eg. mqtt://192.168.0.1<br/>

## Ports

`1883` MQTT Port<br/>

## Directories

`/data`: Folder where the data is stored, including the app config as well as the inventory folders<br/>

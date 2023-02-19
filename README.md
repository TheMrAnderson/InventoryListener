# Inventory Listener

Listen on an MQTT topic for inventory item numbers. Based upon the item configuration either put them directly on the shopping list or only put them on when the threshold is reached

This is a part of the Inventory system for ClubAnderson

## Variables

`DATAFOLDER`: Folder where the data is stored, including the app config as well as the inventory files
`LOGTOPIC`: MQTT topic to send the event logs
`INVENTORYCONSUMETOPIC`: MQTT topic to send an inventory consume events
`MQTTSERVERADDRESS`: MQTT broker address eg. mqtt://19.168.0.1

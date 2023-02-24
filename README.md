# Inventory Listener

Listen on MQTT topics for inventory updates. Send an item to be added then consume it.  No databases or complex configuration needed, just simple JSON files.  This handles the heavy lifting and different front ends can be deployed anywhere on the network.

This is the backend part of the Inventory system for ClubAnderson.

## Variables

`LOGTOPIC`: MQTT topic to send the event logs from the app<br/>
`TOPICFOLDER`: MQTT folder for all events to be created within
`MQTTSERVERADDRESS`: MQTT broker address eg. mqtt://192.168.0.1<br/>

## Ports

`1883` MQTT Port<br/>

## Directories

`/data`: Folder where the data is stored, including the app config as well as the inventory folders<br/>

## How to Use

Create an inventory object based on the object below and send it to the `INVENTORYADDUPDATETOPIC` topic.  `InventoryType` is an enum with the following options:

- Piece: 0,
- Bulk: 1

New Inventory Object:

```json
{
  "CurrentQty": 3,
  "Config": {
    "SourceURL": null,
    "InventoryType": 0,
    "MinAmount": 1,
    "Description": "M8 x 0.8 Cap Head Screw",
    "Location": "Hardware"
  }
}
```

The inventory is stored in individual files to keep the consuming working fast.  At the end of any inventory update, a list will be returned to the `INVENTORYUPDATEDTOPIC` with the retain flag so this is always available to front ends immediately upon activation.

If a change is needed, such as cycle counts, description, anything just send to the `INVENTORYADDUPDATETOPIC`.  If it's an existing item then it will be edited, otherwise it will be created.

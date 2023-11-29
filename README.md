# Inventory Listener

[![Docker Image Dev - Latest](https://github.com/TheMrAnderson/InventoryListener/actions/workflows/docker-dev.yml/badge.svg?branch=dev)](https://github.com/TheMrAnderson/InventoryListener/actions/workflows/docker-dev.yml)

[![Docker Image Prod - Stable](https://github.com/TheMrAnderson/InventoryListener/actions/workflows/docker-prod.yml/badge.svg?branch=master)](https://github.com/TheMrAnderson/InventoryListener/actions/workflows/docker-prod.yml)

Listen on MQTT topics for inventory updates. Send an item to be added then consume it.  No databases or complex configuration needed, just simple JSON files.  This handles the heavy lifting and different front ends can be deployed anywhere on the network.

This is the backend part of the Inventory system for ClubAnderson.

## Variables

`LOGTOPIC`: MQTT topic to send the event logs from the app<br/>
`TOPICFOLDER`: MQTT folder for all events to be created within<br/>
`MQTTSERVERADDRESS`: MQTT broker address eg. mqtt://192.168.0.1<br/>

## Ports

`1883` MQTT Port<br/>

## Directories

`/data`: Folder where the data is stored, including the app config as well as the inventory json objects<br/>

## How to Use

Create an inventory object based on the object below and send it to the `<TOPICFOLDER>/addupdate` topic.  `InventoryType` is an enum with the following options:

- Piece: 0,
- Bulk: 1
- Quart: 2,
- Gallon: 3,
- Ounce: 4

New Inventory Object:

```json
{
  "ItemNumber": 1000,
  "CurrentQty": 3,
  "MinQty": 1,
  "Description": "M8 x 0.8 Cap Head Screw",
  "SourceURL": null,
  "InventoryType": 0,
  "Manufacturer": "ACME",
  "PartNumber": "123ABC",
  "Location": "Metric Tackle Box",
  "Category": "Hardware"
}

```

The inventory is stored in individual files to keep the consuming working fast.  At the end of any inventory update, a list will be returned to the `<TOPICFOLDER>/updated` with the retain flag so this is always available to front ends immediately upon activation.

If a change is needed, such as cycle counts, description, anything just send to the `<TOPICFOLDER>/addupdate` topic.  If it's an existing item then it will be edited, otherwise it will be created.

For immediate response on long running tasks, the `<TOPICFOLDER>/actionresponse` topic will be updated with pertinent information.

The shopping list is kept in the same folder with the inventory, but will also be sent on `<TOPICFOLDER>/shoppinglist` for other listeners who may want to do something with it.  This also will have the retain flag set so it's a persistent list.  On each inventory update, this list is updated.

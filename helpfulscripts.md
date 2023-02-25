# Docker Build & Run

sudo docker build -t themranderson/inventorylistener:latest .

sudo docker run -e "MQTTSERVERADDRESS=mqtt://172.30.62" -e "DATAFOLDER=.inventory_docker/" -e "LOGTOPIC=logs" -e "TOPICFOLDER=inventory_dev_docker" themranderson/inventorylistener:latest
FROM node:latest

WORKDIR /usr/src/app
COPY package*.json .
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

COPY s. .

EXPOSE 1883

USER node

CMD ["node", "server.js"]
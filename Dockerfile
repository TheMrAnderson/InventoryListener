FROM node:19.6.1-bullseye-slim

RUN mkdir -p -v /data && chown node /data/
WORKDIR /usr/src/app
COPY ./package*.json /usr/src/app/
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

COPY . .

EXPOSE 1883

USER node

CMD ["node", "server.js"]
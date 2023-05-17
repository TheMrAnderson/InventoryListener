FROM node:19.9.0-bullseye-slim

RUN mkdir -p -v /data && chown node /data/
WORKDIR /usr/src/app
COPY ./package*.json /usr/src/app/
RUN npm install --force
# If you are building your code for production
# RUN npm ci --only=production

COPY . .

RUN chown -R node /data && chown -R node /usr/src/app

EXPOSE 1883

USER node

CMD ["node", "server.js"]
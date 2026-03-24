FROM node:20.10.0

USER node

RUN mkdir -p /home/node/app && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY --chown=node:node . .

RUN npm install

RUN node --max-old-space-size=460 ./node_modules/.bin/tsc

EXPOSE 8000

CMD ["node", "-r", "dotenv/config", "build/server.js"]
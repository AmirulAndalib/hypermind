FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY server.js ./

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]

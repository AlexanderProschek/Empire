FROM node:16-alpine

WORKDIR /app

COPY public ./public
COPY app.js .
COPY package.json .
COPY package-lock.json .

RUN npm install

ENV PORT=80

EXPOSE 80

CMD ["npm", "start"]
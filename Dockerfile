FROM node:16-alpine

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm install

COPY public ./public
COPY app.js .

ENV PORT=80
EXPOSE 80

CMD ["npm", "start"]
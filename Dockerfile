FROM node:23-alpine

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

ENV VITE_API_ENDPOINT=https://paste.gabrieleminafra.me

RUN npm run build

EXPOSE 3000

CMD [ "npm", "start" ]

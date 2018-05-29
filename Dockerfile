FROM node:carbon
WORKDIR /usr/src/app

# RUN apt-get update && apt-get install -y \
# 	redis-server

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD [ "npm", "start" ]
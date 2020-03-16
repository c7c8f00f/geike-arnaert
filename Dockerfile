FROM debian:10-slim

RUN apt update
RUN apt install -y --no-install-suggests ffmpeg libopus0 libogg0 opus-tools libsodium23 libtool curl
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN apt install -y nodejs
RUN apt install -y make build-essential autoconf

WORKDIR /usr/local/geike/

COPY package*.json ./

RUN npm install

COPY geike.js *.wav *.mp3 ./

CMD ["node", "geike.js"]

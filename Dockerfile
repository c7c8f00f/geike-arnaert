FROM debian:9

RUN apt update
RUN apt install -y --no-install-suggests ffmpeg libopus0 libogg0 opus-tools libsodium18 libtool curl
RUN curl -sL https://deb.nodesource.com/setup_11.x | bash -
RUN apt install -y nodejs
RUN apt install -y make build-essential autoconf

WORKDIR /usr/local/geike/

COPY package*.json ./

RUN npm install

COPY geike.js *.wav *.mp3 ./

CMD ["node", "geike.js"]

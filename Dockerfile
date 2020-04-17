FROM debian:sid-slim

RUN apt update \
    && apt upgrade -yq \
    && apt install -yq --no-install-suggests ffmpeg libopus0 libogg0 opus-tools libsodium23 libtool curl make build-essential autoconf \
    && curl -sL https://deb.nodesource.com/setup_13.x | bash - \
    && apt install -yq nodejs \
    && groupadd -g 226 geike \
    && useradd -u 226 -g 226 -md /usr/local/geike -s /usr/sbin/nologin geike

USER geike:geike

WORKDIR /usr/local/geike/

COPY package*.json ./

RUN npm install

COPY geike.js *.wav *.mp3 ./

CMD ["node", "geike2.js"]

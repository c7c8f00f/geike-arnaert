FROM debian:9

RUN echo 'Acquire::http { Proxy "http://10.1.2.1:3142"; }' | tee -a /etc/apt/apt.conf.d/proxy
RUN apt update
RUN apt install -y --no-install-suggests ffmpeg libopus0 libogg0 opus-tools libsodium18 libtool curl git
RUN curl -sL https://deb.nodesource.com/setup_11.x | bash -
RUN apt install -y nodejs
RUN apt install -y make build-essential autoconf

WORKDIR /usr/local/geike/

COPY package*.json *.mp3 ./

RUN npm install

COPY geike.js ./

CMD ["node", "geike.js"]

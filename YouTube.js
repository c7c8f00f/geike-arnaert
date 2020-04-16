import https from 'https';
import ytdl from 'ytdl-core';
import util from 'util';

const YT_API_TPL = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=%s&key=%s";

export default class YouTube {
  constructor(config) {
    this.config = config;
  }

  isValidUrl(url) {
    return ytdl.validateURL(url);
  }

  isValidId(id) {
    return ytdl.validateID(id);
  }

  getIdFromUrl(url) {
    return ytdl.getVideoID(url);
  }

  getNameForId(id) {
    return new Promise((resolve, reject) => {
      https.get(util.format(YT_API_TPL, id, this.config.googleToken), res => {
        res.setEncoding('utf8');
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('error', reject);
        res.on('end', () => {
          resolve(JSON.parse(data).items[0].snippet.title);
        });
      });
    });
  }

  open(url) {
    return ytdl(url, this.config.ytdlOptions);
  }
}

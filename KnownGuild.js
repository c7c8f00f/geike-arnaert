import scatter from 'bubble-scatter';
import frequencies from './frequencies.js';

// From 'fast-shuffle'. Node is unable to locate the function however
function shuffle(deck) {
  const random = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Math.random;
  const clone = deck.slice(0);
  let srcIndex = deck.length;
  let dstIndex = 0;
  const shuffled = new Array(srcIndex);

  while (srcIndex) {
    const randIndex = srcIndex * random() | 0;
    shuffled[dstIndex++] = clone[randIndex];
    clone[randIndex] = clone[--srcIndex];
  }

  return shuffled;
}

export default class KnownGuild {
  constructor(id, config) {
    this.id = id;
    this.config = config;
    this.currentlyPlaying = undefined;
    this.playlist = undefined;
    this.songHistory = [];
  }

  isChannelBlacklisted(channel) {
    return this._contains(this.config.blacklist, channel.name);
  }

  getPlaylist() {
    let playlist = this.playlist;
    if (!this.playlist || this.playlist.length === 0) {
      playlist = this._generatePlaylist();
      this.playlist = playlist;
    }

    return playlist;
  }

  resetPlaylist() {
    delete this.playlist;
    this.getPlaylist();
  }

  _contains(array, elem) {
    return array.indexOf(elem) >= 0;
  }

  _generatePlaylist() {
    const songs = this.config.songs;
    const expSongs = [];
    songs.forEach(song => {
      for (let i = 0; i < frequencies[song.p]; ++i) {
        expSongs.push(song);
      }
    });
    return scatter(shuffle(expSongs));
  }
};

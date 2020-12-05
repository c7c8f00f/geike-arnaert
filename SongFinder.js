import ssdeep from 'ssdeep.js';
import UserFriendlyError from './UserFriendlyError.js';

export default class SongFinder {
  constructor(config, logger, youtube, messageSender) {
    this.config = config;
    this.logger = logger;

    this.messageSender = messageSender;

    this.youtube = youtube;
  }

  async find(msg, guild, songRef) {
    let song;
    let youtubeId;
    if (this.youtube.isValidUrl(songRef) || this.youtube.isValidId(songRef)) {
      youtubeId = this.youtube.getIdFromUrl(songRef);
    }
    if (youtubeId) {
      song = guild.config.songs.find(song => song.ytdl === youtubeId);
    } else {
      const refHash = ssdeep.digest(songRef.toLowerCase());
      const matching = guild.config.songs
        .map(song => {
          if (!song.titleHash) {
            song.titleHash = ssdeep.digest(song.title.toLowerCase());
          }
          return { song, similarity: ssdeep.similarity(song.titleHash, refHash) };
        })
        .filter(({ song, similarity }) => similarity >= 50)
        .sort((a, b) => a.similarity - b.similarity);
      if (matching.length > 0) song = matching.pop().song;
    }

    if (song) {
      song.inLibrary = true;
      return song;
    }

    if (!youtubeId) return undefined;

    return this._findYoutubeSong(msg, guild, songRef, youtubeId);
  }

  async _findYoutubeSong(msg, guild, songRef, youtubeId) {
    const id = youtubeId;
    let title;
    try {
      title = await this.youtube.getNameForId(id);
    } catch (ex) {
      throw new UserFriendlyError('De naam van de video kan niet gevonden worden', ex);
    }

    return {
      title,
      p: 'tijdelijk',
      ytdl: id,
      inLibrary: false,
    };
  }
}

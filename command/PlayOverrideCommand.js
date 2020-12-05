import { allOk } from '../assert.js';
import Command from './Command.js';
import UserFriendlyError from '../UserFriendlyError.js';

export default class PlayOverrideCommand extends Command {
  constructor(config, logger, messageSender, songPlayer, songFinder) {
    super(config, logger);
    allOk(arguments);

    this.messageSender = messageSender;
    this.songPlayer = songPlayer;
    this.songFinder = songFinder;

    this.regex = /^speel( hierna| nu) (.*)$/i;
    this.simple = 'speel {hierna | nu} NUMMER';
    this.help = 'Forceert Geike om een ander nummer te spelen';
  }

  async action(msg, match, guild) {
    const vp = guild.voicePipe;
    if (!vp) {
      throw new UserFriendlyError('Er wordt op dit moment niet gespeeld op deze server');
    }

    const songRef = match[2].trim();
    const urgent = match[1].trim() === 'nu';

    const song = await this.songFinder.find(msg, guild, songRef);
    if (!song) {
      throw new UserFriendlyError(`${songRef} kan niet gevonden worden`);
    }

    if (!song.inLibrary && msg.author) {
      song.by = msg.author.id;
    }

    if (!await this.songPlayer.isInCache(song)) {
      await this.messageSender.reply(msg, `${song.title} wordt verwerkt...`);
      await this.songPlayer.cache(song);
    }

    const playlist = guild.getPlaylist();
    playlist.unshift(song);

    if (urgent) {
      await this.songPlayer.next(guild);
    }

    return this.messageSender.reply(msg, `${song.title} wordt ${match[1].trim()} gespeeld`);
  }

}

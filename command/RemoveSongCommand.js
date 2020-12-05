import { allOk } from '../assert.js';
import Command from './Command.js';

export default class RemoveSongCommand extends Command {
  constructor(config, logger, messageSender, youtube, songFinder) {
    super(config, logger);
    allOk(arguments);

    this.messageSender = messageSender;
    this.youtube = youtube;
    this.songFinder = songFinder;

    this.regex = /^verwijder (.*)$/i;
    this.simple = 'verwijder NUMMER';
    this.help = 'Verwijdert een nummer uit de bibliotheek';
    this.modifiesConfig = true;
  }

  async action(msg, match, guild) {
    const songRef = match[1].trim();

    let song;
    if (songRef === 'dit') {
      song = guild.currentSong;
    } else {
      song = await this.songFinder.find(msg, guild, songRef);
    }

    if (!song) {
      if (songRef !== 'dit') {
        return this.messageSender.reply(msg, 'Er wordt op dit moment geen nummer gespeeld');
      } else {
        return this.messageSender.reply(msg, `Er is geen nummer met naam of link ${songRef} in de bibliotheek`);
      }
    }

    this._removeFromArray(guild.config.songs, song);
    guild.resetPlaylist();
    return this.messageSender.reply(msg, `${songRef} wordt niet meer gespeeld`);
  }

  _removeFromArray(array, el) {
    const idx = array.indexOf(el);
    if (idx <= -1) return;
    array.splice(idx, 1);
  }
}

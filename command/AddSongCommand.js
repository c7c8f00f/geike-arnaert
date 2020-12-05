import { allOk } from '../assert.js';
import Command from './Command.js';

export default class AddSongCommand extends Command {
  constructor(config, logger, messageSender, youtube, songPlayer, songFinder) {
    super(config, logger);
    allOk(arguments);

    this.messageSender = messageSender;
    this.youtube = youtube;
    this.songPlayer = songPlayer;
    this.songFinder = songFinder;

    this.regex = /^speel (vaak|soms|zelden) (.*)$/i;
    this.simple = 'speel {vaak | soms | zelden} NUMMER';
    this.help = 'Voegt een number toe aan de bibliotheek of past de frequentie aan';
    this.modifiesConfig = true;
  }

  async action(msg, match, guild) {
    const songRef = match[2].trim();
    const freq = match[1].trim();

    let song = await this.songFinder.find(msg, guild, songRef);
    if (!song) {
      return this.messageSender.reply(msg,
        `${songRef} staat niet in de lijst van nummers en is geen geldige YouTube video`
      );
    }

    song.p = freq;

    if (!song.inLibrary) {
      if (msg.author) song.by = msg.author.id;
      song.inLibrary = true;
      guild.config.songs.push(song);
    }

    if (!await this.songPlayer.isInCache(song)) {
      await this.messageSender.reply(msg, `${song.title} wordt verwerkt...`);
      await this.songPlayer.cache(song);
    }

    delete guild.playlist;
    return this.messageSender.reply(msg, `${song.title} wordt voortaan ${freq} gespeeld`);
  }
}

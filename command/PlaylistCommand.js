import { allOk } from '../assert.js';
import Command from './Command.js';
import Discord from "discord.js";

export default class PlaylistCommand extends Command {
  constructor(config, logger, messageSender, songListSender) {
    super(config, logger);
    allOk(arguments);

    this.messageSender = messageSender;
    this.songListSender = songListSender;

    this.regex = /^(afspeellijst|snitlys)( volledig)?$/i;
    this.simple = 'afspeellijst';
    this.help = 'Toont de huidige afspeellijst';
  }

  async action(msg, match, guild) {
    const songs = guild.playlist;
    if (!songs) {
      return this.messageSender.reply(msg, 'Er is op dit moment geen afspeellijst');
    }

    return this.songListSender.sendList(msg, songs, match[1], !!match[2]);
  }
}

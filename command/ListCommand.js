import Discord from 'discord.js';
import { allOk } from '../assert.js';
import Command from './Command.js';

export default class ListCommand extends Command {
  constructor(config, logger, messageSender, songListSender) {
    super(config, logger);
    allOk(arguments);

    this.messageSender = messageSender;
    this.songListSender = songListSender;

    this.regex = /^(bieb|bibliotheek)$/i;
    this.simple = 'bieb';
    this.help = 'Geeft de volledige lijst van nummers in de bibliotheek';
  }

  async action(msg, match, guild) {
    const songs = guild.config.songs;
    return this.songListSender.sendList(msg, songs, match[1]);
  }
}

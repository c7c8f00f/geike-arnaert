import { allOk } from '../assert.js';
import Command from './Command.js';

export default class NextSongCommand extends Command {
  constructor(config, logger, messageSender) {
    super(config, logger);
    allOk(arguments);

    this.messageSender = messageSender;

    this.regex = /^volgende$/i;
    this.simple = 'volgende';
    this.help = 'Gaat naar het volgende nummer in de afspeellijst';
  }

  async action(msg, match, guild) {
    if (!guild.currentStream) {
      return this.messageSender.reply(msg, `Er wordt op dit moment niet gespeeld op deze server`);
    }

    guild.currentStream.destroy(new Error('next'));
  }
}

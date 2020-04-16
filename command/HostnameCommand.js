import os from 'os';
import { allOk } from '../assert.js';
import Command from './Command.js';

export default class HostnameCommand extends Command {
  constructor(config, logger, messageSender) {
    super(config, logger);
    allOk(arguments);

    this.messageSender = messageSender;

    this.regex = /^hostnaam$/;
    this.simple = 'hostnaam';
    this.help = 'Print de hostnaam van de bot';
    this.guild = '518091238524846131';
  }

  async action(msg, match, guild) {
    return this.messageSender(msg, os.hostname());
  }
}

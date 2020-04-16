import { allOk } from '../assert.js';
import Command from './Command.js';

export default class InsultCommand extends Command {
  constructor(config, logger, messageSender) {
    super(config, logger);
    allOk(arguments);

    this.messageSender = messageSender;

    this.regex = /^luister( (teef|bitch))?$/i;
  }

  async action(msg, match, guild) {
    return this.messageSender.reply(msg, 'Is het nou nog niet goed? 🖕😡🖕');
  }
}

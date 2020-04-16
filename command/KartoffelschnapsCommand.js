import { allOk } from '../assert.js';
import Command from './Command.js';

export default class KartoffelschnapsCommand extends Command {
  constructor(config, logger) {
    super(config, logger);
    allOk(arguments);

    this.regex = /^kartoffelschnaps$/;
    this.guild = '210075118716715019';
  }

  async action(msg, match, guild) {
    return msg.react(msg.guild.emojis.get('567418410384883788'));
  }
}

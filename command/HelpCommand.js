import { allOk } from '../assert.js';
import Command from './Command.js';

export default class HelpCommand extends Command {
  constructor(config, logger, messageSender, commands) {
    super(config, logger);
    allOk(arguments);

    this.messageSender = messageSender;
    this.commands = commands;

    this.regex = /^help$/i;
    this.simple = 'help';
    this.help = 'Toon beschikbare commando\'s';
  }

  async action(msg, match, guild) {
    return this.messageSender.reply(msg, "\n" + this.commands
      .filter(cmd => (!cmd.guild || cmd.guild === msg.guild.id) && cmd.help)
      .map(cmd => guild.config.cmdPrefix + ' ' + cmd.simple + ' — ' + cmd.help.replace('!geike', guild.cmdPrefix))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .join('\n')
    );
  }
}

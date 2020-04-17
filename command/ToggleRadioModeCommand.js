import Command from './Command.js';

export default class ToggleRadioModeCommand extends Command {
  constructor(config, logger, messageSender) {
    super(config, logger);

    this.messageSender = messageSender;

    this.regex = /^radio (uit|aan)$/i;
    this.simple = 'radio {uit | aan}';
    this.help = 'Zet radio mode aan of uit';
  }

  async action(msg, match, guild) {
    guild.config.radio = (match[1] === 'aan');
    return this.messageSender.reply(msg, `Automatisch doorspelen staat ${match[1]}`);
  }
}

import { storeConfig } from './config.js';
import { allOk } from './assert.js';

export default class MessageHandler {
  constructor(config, logger, messageSender, guildRepository, commands, magicCommands) {
    this.config = config;
    this.logger = logger;
    this.messageSender = messageSender;
    this.guildRepository = guildRepository;
    this.commands = commands;
    this.magicCommands = magicCommands;

    allOk(arguments);
  }

  handle(msg) {
    let guildId = msg.guild.id;
    let guild = this.guildRepository.find(guildId);

    const magicCmdString = msg.content.trim();
    const anyMagicSucceeded = this._tryCommands(this.magicCommands, guildId, magicCmdString, msg, guild);

    if (!guild.config.cmdPrefix) guild.config.cmdPrefix = '!geike';
    if (!msg.content.startsWith(guild.config.cmdPrefix + ' ') || msg.author.id === this.config.userId) return;

    let cmdString = msg.content.substring(guild.config.cmdPrefix.length).trim();
    let anySucceeded = this._tryCommands(this.commands, guildId, cmdString, msg, guild);

    if (!anySucceeded && !anyMagicSucceeded) {
      this.messageSender.reply(msg, "Ik weet niet wat je daarmee bedoelt...").catch(e => this.logger.err(e));
    }
  }

  _tryCommands(comms, guildId, cmdString, msg, guild) {
    return comms
      .filter(cmd => !cmd.guild || cmd.guild === guildId)
      .map(cmd => {
        let match = cmd.regex.exec(cmdString);
        if (!match) return false;

        try {
          cmd.action(msg, match, guild, comms).then(() => {
            if (cmd.modifiesConfig) storeConfig(this.config, this.logger);
          }).catch(ex => this.logger.err(ex));
        } catch (ex) {
          this.logger.err(ex);
        }

        return true;
      })
      .some(r => r);
  }
};

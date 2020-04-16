import Command from './Command.js';

export default class UnBlacklistCommand extends Command {
  constructor(config, logger, client, messageSender) {
    super(config, logger);

    this.client = client;
    this.messageSender = messageSender;

    this.regex = /^deblokkeer (.*)$/i;
    this.simple = 'deblokkeer KANAAL';
    this.help = 'Staat Geike weer toe te verbinden met het gegeven kanaal'
  }

  async action(msg, match, guild) {
    const channelName = match[1];
    const channel = this.client.channels.cache.find(ch => ch.guild.id === msg.guild.id && ch.name === channelName);
    if (!channel) {
      return this.messageSender.reply(msg, `Het kanaal ${channelName} kan niet gevonden worden`);
    }

    const idx = guild.config.blacklist.indexOf(channel.id);
    if (idx === -1) {
      return this.messageSender.reply(msg, `Het kanaal ${channelName} is niet geblokkeerd`);
    }

    guild.config.blacklist.splice(idx, 1);
    return this.messageSender.reply(msg, `Het kanaal ${channelName} is vanaf nu gedeblokkeerd`);
  }
}

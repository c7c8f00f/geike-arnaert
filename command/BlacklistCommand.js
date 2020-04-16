import Command from './Command.js';

export default class BlacklistCommand extends Command {
  constructor(config, logger, client, messageSender) {
    super(config, logger);

    this.client = client;
    this.messageSender = messageSender;

    this.regex = /^blokkeer (.*)$/i;
    this.simple = 'blokkeer KANAAL';
    this.help = 'Voorkomt dat Geike verbindt met het gegeven kanaal';
  }

  async action(msg, match, guild) {
    const channelName = match[1];
    const channel = this.client.channels.cache.find(ch => ch.guild.id === msg.guild.id && ch.name === channelName);
    if (!channel) {
      return this.messageSender.reply(msg, `Het kanaal ${channelName} kan niet gevonden worden`);
    }

    if (guild.config.blacklist.indexOf(channel.id) !== -1) {
      return this.messageSender.reply(msg, `Het kanaal ${channelName} is al geblokkeerd`);
    }

    guild.config.blacklist.push(channel.id);
    return this.messageSender.reply(msg, `Het kanaal ${channelName} is vanaf nu geblokkeerd`);
  }
}

export default class ChannelWatcher {
  constructor(client, logger, guildRepository, onConnect, onDisconnect) {
    this.client = client;
    this.logger = logger;
    this.guildRepository = guildRepository;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
    this.previousEmpty = [];
    this.currentEmpty = [];
  }

  start() {
    this.interval = setInterval(() => this._watch().catch(e => this.logger.err(e)), 100);
  }

  stop() {
    if (!this.interval) return;
    clearInterval(this.interval);
    delete this.interval;
  }

  async _watch() {
    this.previousEmpty = [];
    this.currentEmpty.forEach(ch => this.previousEmpty.push(ch));
    this.currentEmpty = [];

    const channels = this._getVoiceChannels();
    channels.forEach(channel => {
      const channelMembers = channel['members'];
      if (channelMembers.size === 1 && channelMembers.get(this.client.user.id) !== undefined) {
        this.logger.log(`I'm the only one left in ${channel.name} (in ${channel.guild})`);
        this.onDisconnect(channel);
      }

      if (channelMembers.size === 0) {
        this.currentEmpty.push(channel);
      }
    });

    this._diff(this.previousEmpty, this.currentEmpty).forEach(channel => {
      const guild = this.guildRepository.find(channel.guild.id);
      if (guild.config.blacklist.indexOf(channel.id) !== -1) {
        this.logger.log(`Blacklisted from ${channel.guild}${channel} — not joining`);
      } else {
        this.logger.log(`Target acquired in ${channel.guild}#${channel.name}`);
        this.onConnect(channel);
      }
    });
  }

  _getVoiceChannels() {
    return this.client.channels.cache.filter(channel => channel.type === 'voice');
  }

  _diff(b, a) {
    return b.filter(function(i) {return a.indexOf(i) < 0;});
  };
};

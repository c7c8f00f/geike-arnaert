import KnownGuild from './KnownGuild.js';

export default class GuildRepository {
  constructor(config, logger, onUpdate = () => {}) {
    this.config = config;
    this.logger = logger;
    this.onUpdate = onUpdate;
    this.loadedGuilds = {};
  }

  find(id) {
    if (id in this.loadedGuilds) {
      return this.loadedGuilds[id];
    }

    if (!this.config.guilds[id]) {
      this.config.guilds[id] = JSON.parse(JSON.stringify(this.config.guilds._default));
    }
    const guildConfig = this.config.guilds[id];

    this.loadedGuilds[id] = new KnownGuild(id, guildConfig);
    return this.loadedGuilds[id];
  }

  store(guild) {
    this.config.guilds[i] = guild.config;
    this.onUpdate(this.config);
  }
};

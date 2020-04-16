export default class Command {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;

    this.regex = / ^/;
    this.modifiesConfig = false;
  }

  async action(msg, match, guild) {
    throw new Error("Not implemented");
  }
}

import { allOk } from '../assert.js';
import Command from './Command.js';
import UserFriendlyError from '../UserFriendlyError.js';

export default class JoinCommand extends Command {
  constructor(config, logger, client, songPlayer, messageSender) {
    super(config, logger);
    allOk(arguments);

    this.client = client;
    this.songPlayer = songPlayer;
    this.messageSender = messageSender;

    this.regex = /^kom( hier)?$/i;
    this.simple = 'kom';
    this.help = 'Haalt Geike naar je huidige kanaal';
  }

  async action(msg, match, guild) {
    if (guild.voicePipe && guild.currentChannel) {
      throw new UserFriendlyError(`Er wordt op deze server al gespeeld in ${guild.currentChannel}`);
    }

    this.client.channels.cache
      .filter(channel => channel.type === 'voice' &&  channel.members.has(msg.author.id))
      .forEach(ch => {
        this.songPlayer.init(guild);
        this.songPlayer.play(ch, guild);
      });
  }
}

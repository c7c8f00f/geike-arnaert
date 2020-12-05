import { allOk } from '../assert.js';
import Command from './Command.js';
import UserFriendlyError from '../UserFriendlyError.js';

export default class CurrentSongCommand extends Command {
  constructor(config, logger, client, messageSender) {
    super(config, logger);
    allOk(arguments);

    this.client = client;
    this.messageSender = messageSender;

    this.regex = /^huidig( nummer)?$/i;
    this.simple = 'huidig';
    this.help = 'Haalt informatie over het huidige nummer op';
  }

  async action(msg, match, guild) {
    const song = guild.currentSong;
    if (!song) {
      throw new UserFriendlyError('Er wordt op dit moment geen nummer gespeeld');
    }

    let addedByStr = '';
    if (song.by) {
      let user = await this.client.users.fetch(song.by);
      if (user && user.tag) {
        addedByStr = ` en is toegevoegd door ${user.tag}`;
      }
    }

    return this.messageSender.reply(msg,
      `Op dit moment wordt ${song.title} gespeeld. Dit wordt ${song.p} gespeeld${addedByStr}`
    );
  }
}

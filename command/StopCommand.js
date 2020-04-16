import { allOk } from '../assert.js';
import Command from './Command.js';

export default class StopCommand extends Command {
  constructor(config, logger, songPlayer) {
    super(config, logger);
    allOk(arguments);

    this.songPlayer = songPlayer;

    this.regex = /^stop$/i;
    this.simple = 'stop';
    this.help = 'Stopt het afspelen';
  }

  async action(msg, match, guild) {
    this.songPlayer.stop(guild);
  }
}

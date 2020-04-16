import { allOk } from '../assert.js';
import Command from './Command.js';
import {storeConfig} from '../config.js';

const F00F_GUILD_ID = '518091238524846131';

export default class DumpConfigCommand extends Command {
  constructor(config, logger) {
    super(config, logger);
    allOk(arguments);

    this.regex = /^(dump|geef) config(uratie weer)? $/i;
    this.simple = 'dump config';
    this.help = 'Dumpt de volledige configuratie, exclusief geheime tokens';
    this.guild = F00F_GUILD_ID;
  }

  action(msg) {
    storeConfig(this.config, this.logger);
  }
};

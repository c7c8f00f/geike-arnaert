import { allOk } from '../assert.js';
import Command from './Command.js';

export default class HistoryCommand extends Command {
    constructor(config, logger, songListSender) {
        super(config, logger);
        allOk(arguments);
        this.songListSender = songListSender;

        this.regex = /^(geschiedenis|skiednis)/i;
        this.simple = 'geschiedenis';
        this.help = 'Geeft de recent gespeelde nummers';
    }

    async action(msg, match, guild) {
        const songs = guild.songHistory;
        return this.songListSender.sendList(msg, songs, match[1], false, false, true);
    }
}

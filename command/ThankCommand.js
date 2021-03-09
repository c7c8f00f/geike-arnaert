import { allOk } from '../assert.js';
import Command from './Command.js';

export default class ThankCommand extends Command {
    constructor(config, logger, messageSender) {
        super(config, logger);
        allOk(arguments);

        this.messageSender = messageSender;

        this.regex = /^(bedankt|dankje|dankjewel|danku|dankuwel|kiitos)$/i;
    }

    async action(msg, match, guild) {
        switch (match[1]) {
            case 'bedankt':
            case 'dankje':
            case 'dankjewel':
                return this.messageSender.reply(msg, 'Graag gedaan!');
            case 'kiitos':
                return this.messageSender.reply(msg, 'Ole hyvä!');
        }
    }
}

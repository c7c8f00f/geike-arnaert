import axios from 'axios';
import { allOk } from '../assert.js';
import Command from './Command.js';
import getVersion from '../version.js';

export default class VersionCommand extends Command {
    constructor(config, logger, messageSender) {
        super(config, logger);
        allOk(arguments);

        this.messageSender = messageSender;

        this.regex = /^versie$/i;
    }

    async action(msg, match, guild) {
        const version = getVersion();

        if (!version) {
            return this.messageSender.reply(msg, "Versieinformatie is niet beschikbaar");
        }

        let changelog = '';
        try {
            const wikiPage = encodeURIComponent('nl/logboek/' + version);
            const res = await axios.get(
                'https://git.wukl.net/api/v4/projects/74/wikis/' + wikiPage
            )

            changelog = res.data.content;
        } catch (ex) {
            this.logger.log('Unable to download changelog');
            this.logger.log(ex);
        }

        return this.messageSender.reply(msg, version + (changelog ? '\n' + changelog : ''));
    }
}

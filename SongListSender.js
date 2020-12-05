import Discord from "discord.js";
import CsvStringify from 'csv-stringify';
import frequencies from './frequencies.js';

export default class SongListSender {
  constructor(logger, client) {
    this.logger = logger;
    this.client = client;
  }

  async sendList(msg, songs, listType, allowAttachment = false) {
    const songsTotal = songs.map(s => frequencies[s.p]).reduce((a, b) => a + b, 0);

    let subsonglists = '';
    let included = 0;
    for (let song of songs) {
      const fmtSong = await this._formatSong(song, songsTotal);
      if (subsonglists.length + fmtSong.length < 2000) {
        subsonglists += '\n' + fmtSong;
        ++included;
      } else {
        if (allowAttachment) {
          return this._sendAsAttachment(msg, songs, listType, songsTotal);
        } else {
          break;
        }
      }
    }

    let displayedText = '';
    let partialText = '';
    if (included < songs.length) {
      displayedText = ` (${included} weergegeven)`;
      partialText = ' (onvolledig!)';
    }

    const embed = new Discord.MessageEmbed()
        .setColor([75, 83, 75])
        .setTitle(`${listType}${partialText}`)
        .setDescription(subsonglists)
        .setFooter(`Er zijn ${songs.length} nummers in de ${listType}${displayedText}`);

    return msg.channel.send({ embed }).catch(e => this.logger.err(e));
  }

  async _formatSong(s, songsTotal) {
    let addedByStr = '';
    if (s.by) {
      let user = await this.client.users.fetch(s.by);
      if (user && user.tag) {
        addedByStr = ` — toegevoegd door ${user.tag}`;
      }
    }
    return `${s.title} — ${s.p} (${(frequencies[s.p] / songsTotal * 100).toFixed(2)}%)${addedByStr}`;
  };

  async _sendAsAttachment(msg, songs, listType, songsTotal) {
    let csvLines = '';
    const csvStream = CsvStringify();
    csvStream.write(['titel', 'frequentie', 'kans', 'toegevoegd door']);
    csvStream.on('readable', () => {
      let row;
      while (row = csvStream.read()) {
        csvLines += row;
      }
    });
    csvStream.on('finish', () => {
      const csvBuf = Buffer.from(csvLines);
      return msg.channel.send({ files: [{
          name: `${listType}-${new Date().toLocaleString('nl-NL')}.csv`,
          attachment: csvBuf,
        }] });
    });

    for (let song of songs) {
      let user;
      if (song.by) user = await this.client.users.fetch(song.by);
      csvStream.write([
        song.title,
        song.p,
        (frequencies[song.p] / songsTotal * 100).toFixed(2),
        (user && user.tag) ? user.tag : ''
      ]);
    }

    csvStream.end();
  }
}

import Discord from "discord.js";
import CsvStringify from 'csv-stringify';
import frequencies from './frequencies.js';
import { formatRelative, formatISO, differenceInCalendarDays } from 'date-fns';
import nl from 'date-fns/locale/nl/index.js';

export default class SongListSender {
  constructor(logger, client) {
    this.logger = logger;
    this.client = client;
  }

  async sendList(msg, songs, listType, allowAttachment = false, calcFreq = true, isHistory = false) {
    const songsTotal = songs.map(s => frequencies[s.p]).reduce((a, b) => a + b, 0);

    const now = new Date();

    let subsonglists = '';
    let included = 0;
    let idx = 0;
    for (let song of songs) {
      ++idx;
      const fmtSong = await this._formatSong(song, songsTotal, calcFreq, isHistory, now);
      if (subsonglists.length + fmtSong.length < 2000) {
        subsonglists += `\n${idx}. ${fmtSong}`;
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
        .setFooter(
            `Er ${songs.length === 1 ? 'is' : 'zijn'} ${songs.length} nummer${songs.length === 1 ? '' : 's'} in de ${listType}${displayedText}`
        );

    return msg.channel.send({ embed }).catch(e => this.logger.err(e));
  }

  async _formatSong(s, songsTotal, calcFreq, isHistory, now) {
    let dateStr = '';
    if (s.timestamp) {
      const diff = differenceInCalendarDays(s.timestamp, now);
      const tsStr = formatRelative(s.timestamp, now, { locale: nl, weekStartsOn: 1 });
      dateStr = `, ${isHistory ? 'gespeeld' : 'toegevoegd'}${diff < -6 ? ' op' : ''} ${tsStr}`;
    }

    let addedByStr = '';
    if (s.by) {
      let user = await this.client.users.fetch(s.by);
      if (user && user.tag) {
        addedByStr = `${(isHistory && s.timestamp) ? ', toegevoegd' : ''} door ${user.tag}`;
      }
    }

    let freqStr = '';
    if (calcFreq) {
      freqStr = ` (${(frequencies[s.p] / songsTotal * 100).toFixed(2)}%)`;
    }

    return `${s.title} — ${s.p}${freqStr}${dateStr}${addedByStr}`;
  };

  async _sendAsAttachment(msg, songs, listType, songsTotal) {
    let csvLines = '';
    const csvStream = CsvStringify();
    csvStream.write(['titel', 'frequentie', 'kans', 'toegevoegd door', 'toegevoegd op']);
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
        (user && user.tag) ? user.tag : '',
        song.timestamp ? formatISO(song.timestamp) : '',
      ]);
    }

    csvStream.end();
  }
}

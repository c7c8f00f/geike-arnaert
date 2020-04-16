import Discord from "discord.js";
import frequencies from '../frequencies.js';

export default class SongListSender {
  constructor(logger, client) {
    this.logger = logger;
    this.client = client;
  }

  async sendList(msg, songs, listType) {
    const songsTotal = songs.map(s => frequencies[s.p]).reduce((a, b) => a + b, 0);

    let makeEmbed = (i, num) => {
      return new Discord.MessageEmbed()
        .setColor([75, 83, 75])
        .setTitle(listType)
        .setFooter(`Er zijn ${songs.length} nummers in de ${listType} ${num > 1 ? `(${i + 1}/${num})` : ''}`);
    };

    let formatSong = async (s) => {
      let addedByStr = '';
      if (s.by) {
        let user = await this.client.users.fetch(s.by);
        if (user && user.tag) {
          addedByStr = ` — toegevoegd door ${user.tag}`;
        }
      }
      return `${s.title} — ${s.p} (${(frequencies[s.p] / songsTotal * 100).toFixed()}%)${addedByStr}`;
    };

    let subsonglists = [''];
    for (let song of songs) {
      const fmtSong = await formatSong(song);
      if (subsonglists[subsonglists.length - 1].length + fmtSong.length < 2000) {
        subsonglists[subsonglists.length - 1] += '\n' + fmtSong;
      } else {
        subsonglists.push(fmtSong);
      }
    }

    let i = 0;
    for (let songlist of subsonglists) {
      msg.channel.send({ embed: makeEmbed(i, subsonglists.length).setDescription(songlist) })
        .catch(e => this.logger.err(e));
      ++i;
    }
  }
}

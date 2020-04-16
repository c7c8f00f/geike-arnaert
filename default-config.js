export default {
  guilds: {
    _default: {
      songs: [
        {title: 'Zoutelande',     p: 'vaak',  file: '/usr/local/geike/zoutelande.mp3'},
        {title: 'Frankfurt Oder', p: 'soms',  file: '/usr/local/geike/frankfurt-oder.mp3'},
        {title: 'Blof Grips',     p: 'zelden', ytdl: 'https://www.youtube.com/watch?v=b6vpW-21c0w'},
        {title: 'OOF',            p: 'zelden', ytdl: 'https://www.youtube.com/watch?v=YMNY2NcSMm8'}
      ],
      songsTotal: 14,
      cmdPrefix: '!geike',
      blacklist: [],
    }
  },

  voiceStreamOptions: { passes: 2, plp: 0.15, fec: true },
  ytdlOptions: { filter: 'audioonly', quality: 'highestaudio' },

  loginToken: 'secret',
  googleToken: 'secret',
  userId: '563365336758616094',

  loggingChannelId: '568023808632553503',
};

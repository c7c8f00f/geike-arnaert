const defaultConfig = {
    guilds: {
        _default: {
            songs: [
                {title: 'Zoutelande',     p: 'vaak',  file: '/usr/local/geike/zoutelande.mp3'},
                {title: 'Frankfurt Oder', p: 'soms',  file: '/usr/local/geike/frankfurt-oder.mp3'},
                {title: 'Blof Grips',     p: 'zelden', ytdl: 'https://www.youtube.com/watch?v=b6vpW-21c0w'},
                {title: 'OOF',            p: 'zelden', ytdl: 'https://www.youtube.com/watch?v=YMNY2NcSMm8'}
            ],
            songsTotal: 14,
        }
    },

    voiceStreamOptions: {passes: 2},
    ytdlOptions: {filter: 'audioonly'},

    loginToken: 'secret',
    userId: '563365336758616094'
};

const frequencies = {zelden: 1, soms: 3, vaak: 9};

const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const fs = require('fs');
const process = require('process');
const os = require("os");
const help = [
        'herlaad configuratie ➡️ Herlaad de configuratie van Geike',
        'geef configuratie weer ➡️ Laat de huidige configuratie van Geike zien',
        'stop! ➡️ Laat Geike stoppen met zingen als ze in een channel zit',
        'SCHREEUW ➡️ Laat Geike luidkeels haar fantastische geluid horen',
        'help ➡️ Laat Geike uitleggen naar welke commandos ze allemaal luistert',
        'waar ben je ➡ ️Geike vertelt op welke server ze draait',
        'kun je dit ook {vaak | soms | zelden} spelen __YT URL__ ➡️ Geike voegt een nieuw nummer aan haar bibliotheek toe',
        'wat kan je allemaal spelen ➡️ Geike stuurt een lijst van alles dat ze kan spelen en hoe vaak',
        'kom {terug | hier} ➡️ haalt Geike terug in het huidige kanaal',
];

let playing_guilds = [];

const configLocation = '/etc/geike/geike.conf';
var config;
if (fs.existsSync(configLocation)) {
    let configFile = fs.readFileSync(configLocation, {encoding: 'utf8'});
    config = JSON.parse(configFile);
} else {
    config = defaultConfig;
    fs.writeFile(configLocation, JSON.stringify(config), {encoding: 'utf8'}, err => {
        if (err) console.log('Unable to save default config: ' + err);
        else console.log('Saved default config');
    });
}

const client = new Discord.Client();

function grabChannels() {
    return client.channels.filter( channel => channel.type === "voice");
}

Array.prototype.diff = function(a) {
    return this.filter(function(i) {return a.indexOf(i) < 0;});
};

Array.prototype.contains = function (el) {
    return this.indexOf(el) >= 0;
};

Array.prototype.remove = function (el) {
    if (this.contains(el)) {
        this.splice(this.indexOf(el), 1)
    }
    return this
};

function findGuildConfig(guildId) {
    if (!config.guilds[guildId]) {
        config.guilds[guildId] = JSON.parse(JSON.stringify(config.guilds._default));
    }
    return config.guilds[guildId];
}

function findSong(guildId) {
    let guild = findGuildConfig(guildId);

    var cuml = 0;
    var q = Math.random();

    for (var i = 0; i < guild.songs.length; ++i) {
        const song = guild.songs[i];
        cuml += frequencies[song.p]/guild.songsTotal || 0;
        if (q <= cuml) return song;
    }

    return guild.songs[guild.songs.length - 1];
}

function playSong(conn, song) {
    console.log('Playing ' + song.title);
    if ('file' in song) {
        return conn.playFile(song.file, config.voiceStreamOptions);
    } else if ('ytdl' in song) {
        return conn.playStream(ytdl(song.ytdl, config.ytdlOptions), config.voiceStreamOptions);
    } else {
        console.log("Don't know how to play " + JSON.stringify(song));
        return undefined;
    }
}

async function play(channel) {
    if (playing_guilds.contains(channel.guild)) {
        console.log("Already playing on " + channel.guild);
        return;
    }

    const connection = await channel.join();
    console.log("Joining " + connection.channel.name + " (" + connection.channel.guild + ")");
    let dispatcher = playSong(connection, findSong(channel.guild.id));
    if (!dispatcher) return;
    playing_guilds.push(channel.guild);
    dispatcher.setVolume(1);
    dispatcher.on('end', reason => {
        console.log("Song ended/DC-ed, disconnecting from " + connection.channel.name + " (" + connection.channel.guild + ") with reason " + reason);
        connection.disconnect();
        dispatcher.destroy();
        playing_guilds.remove(channel.guild)
    });
}

async function disconnect(channel) {
    console.log("disconnecting from " + channel.name + " (" + channel.guild + ")");
    const connection = await client.channels.filter(chl => chl.type === "voice").filter(chnl => chnl['id'] === channel['id']).first().join();
    connection.disconnect()
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    var previous_empty = [];
    var empty_channels = [];
    setInterval(() => {
        previous_empty = [];
        empty_channels.forEach(channel => previous_empty.push(channel));
        empty_channels = [];
        grabChannels().forEach(channel => {
            if (channel['members'].size === 1 && channel['members'].get(config.userId) !== undefined) {
                console.log("I'm the only one left in " + channel.name + " (" + channel.guild + ")");
                disconnect(channel);
            }

            if (channel['members'].size === 0) {
                empty_channels.push(channel);
            }
        });
        previous_empty.diff(empty_channels).forEach(channel => {
            console.log("Target acquired in " + channel.name + " (" + channel.guild + ")");
            play(channel);
        });

    }, 1000);
});

// When adding a new command to Geike, please also add that command to the 'help' constant.
client.on('message', msg => {
    if (msg.content === '!geike herlaad configuratie') {
        if (fs.existsSync(configLocation)) {
            let configFile = fs.readFileSync(configLocation, {encoding: 'utf8'});
            config = JSON.parse(configFile);
            msg.react('👍');
        } else {
            msg.react('👎');
        }
    } else if (/!geike kun je dit ook (soms|vaak|zelden) spelen (.*)/gm.exec(msg.content)) {
        let guild = findGuildConfig(msg.guild.id);
        const info = /!geike kun je dit ook (soms|vaak|zelden) spelen (.*)/gm.exec(msg.content);
        console.log(info[2] + " gaan we " + info[1] + " spelen");
        if (info[1] === "soms" || "vaak" || "zelden") {
            if (ytdl.validateURL(info[2])) {
                guild.songs.push({title: ytdl.getURLVideoID(info[2]), p: info[1], ytdl: info[2]});
                guild.songsTotal += frequencies[info[1]];
                msg.reply("Oké, ik ga het " + info[1] + " spelen!");
            } else {
                msg.reply("Leugens! Dit is geen echte YT URL!");
            }
        } else {
            msg.reply("Geen idee wat je bedoelt...");
        }
    } else if (msg.content === '!geike geef configuratie weer') {
        let censoredConfig = {};
        Object.assign(censoredConfig, config);
        delete censoredConfig.loginToken;
        msg.reply(JSON.stringify(censoredConfig, null, 2));
    } else if (msg.content === '!geike stop!') {
        msg.guild.channels.forEach(channel => {
            if (channel.type === "voice" && channel['members'].get(config.userId) !== undefined) {
                msg.react('🙄');
                msg.reply('Oké 😞');
                disconnect(channel);
            }
        });
    } else if (msg.content === '!geike help') {
        msg.reply("\n" + help.sort((a, b) => a.toLowerCase() < b.toLowerCase()).join('\n'));
    } else if (msg.content === '!geike SCHREEUW') {
        msg.guild.channels.forEach(channel => {
            if (channel.type !== 'voice' || !channel['members'].get(config.userId)) return;

            let conn = channel.connection;
            if (!conn) return;

            let dispatcher = conn.dispatcher;
            if (!dispatcher) return;

            dispatcher.setVolume(2);
        });
    } else if (msg.content === '!geike kartoffelschnaps') {
        if (msg.guild.id !== '210075118716715019') return;
        msg.react(msg.guild.emojis.get('557997588482228255'));
    } else if (msg.content === '!geike waar ben je') {
        msg.reply(os.hostname());
    } else if (msg.content === '!geike luister teef') {
        msg.react('😡');
        msg.react('🖕');
    } else if (msg.content === '!geike wat kan je allemaal spelen') {
        let guild = findGuildConfig(msg.guild.id);
        msg.channel.send(new Discord.RichEmbed()
            .setColor([75, 83, 75])
            .setTitle('Nummers die ik kan spelen')
            .setDescription(guild.songs
                .map(s =>
                    s.title + ' — ' + s.p
                    + ' (' + (frequencies[s.p] / guild.songsTotal * 100).toFixed() + '%)'
                )
                .join('\n')
            )
            .setFooter('Ik kan ' + guild.songs.length + ' nummers spelen')
        );
    } else if (msg.content === '!geike kom terug' || msg.content === '!geike kom hier') {
        grabChannels().forEach(channel => {
            if (!channel.members.has(msg.author.id)) return;
            play(channel);
        });
    }
});
client.login(config.loginToken);

process.on('SIGTERM', () => {
    fs.writeFileSync(configLocation, JSON.stringify(config), {encoding: 'utf8'});

    client.destroy().then(() => process.exit(0));
});

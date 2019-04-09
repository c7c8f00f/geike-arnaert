const defaultConfig = {
    songs: [
         {title: 'Zoutelande',     p: 0.70,  file: '/usr/local/geike/zoutelande.mp3'},
         {title: 'Frankfurt Oder', p: 0.21,  file: '/usr/local/geike/frankfurt-oder.mp3'},
         {title: 'Blof Grips',     p: 0.045, ytdl: 'https://www.youtube.com/watch?v=b6vpW-21c0w'},
         {title: 'OOF',            p: 0.045, ytdl: 'https://www.youtube.com/watch?v=YMNY2NcSMm8'}
    ],

    voiceStreamOptions: {passes: 2},
    ytdlOptions: {filter: 'audioonly'},

    loginToken: 'secret',
    userId: '563365336758616094'
};

const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const fs = require('fs');
const process = require('process');
const help = ['herlaad configuratie ➡️ Herlaad de configuratie van Geike',
                'geef configuratie weer ➡️ Laat de huidige configuratie van Geike zien',
                'stop! ➡️ Laat Geike stoppen met zingen als ze in een channel zit',
                'SCHREEUW ➡️ Laat Geike luidkeels haar fantastische geluid horen'];

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

function findSong() {
    var cuml = 0;
    var q = Math.random();

    for (var i = 0; i < config.songs.length; ++i) {
        const song = config.songs[i];
        cuml += song.p || 0;
        if (q <= cuml) return song;
    }

    return config.songs[config.songs.length - 1];
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

async function play(cid, playing_guilds) {
    const channel = grabChannels().filter(channel => channel['id'] === cid).first();
    if (playing_guilds.contains(channel.guild)) {
        console.log("Already playing on " + channel.guild);
        return;
    }

    const connection = await channel.join();
    console.log("Joining " + connection.channel.name + " (" + connection.channel.guild + ")");
    let dispatcher = playSong(connection, findSong());
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
    var playing_guilds = [];
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
            play(channel['id'], playing_guilds);
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
        msg.reply("\n" + help.join('\n'));
    }
});
client.login(config.loginToken);

process.on('SIGTERM', () => {
    client.destroy().then(() => process.exit(0));
});

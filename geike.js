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
            cmdPrefix: '!geike',
            blacklist: [],
        }
    },

    voiceStreamOptions: { passes: 2, plp: 0.10, fec: true },
    ytdlOptions: { filter: 'audioonly' },

    loginToken: 'secret',
    googleToken: 'secret',
    userId: '563365336758616094',

    loggingChannelId: '568023808632553503',
};

const f00fGuildId = '518091238524846131';

const frequencies = {zelden: 1, soms: 3, vaak: 9};

const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const fs = require('fs');
const process = require('process');
const os = require("os");
const util = require('util');
const https = require('https');

let playing_guilds = new Set();

const googleApi = "https://www.googleapis.com/youtube/v3/videos?part=snippet&id=%s&key=%s";

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

function saveConfig() {
    log(`Saving config file at ${configLocation}`);

    let dupedConfig = {};
    Object.assign(dupedConfig, config);
    dupedConfig.guilds = {};
    Object.keys(config.guilds).forEach((id) => {
        const tpl = config.guilds[id];
        dupedConfig.guilds[id] = {};
        Object.keys(tpl).filter(k => k !== 'dynamic' && k !== 'currentlyPlaying').forEach((k) => {
            dupedConfig.guilds[id][k] =  tpl[k];
        });
    });

    const fd = fs.openSync(configLocation, 'w', 0o600);
    fs.writeSync(fd, JSON.stringify(dupedConfig));
    fs.fdatasyncSync(fd);
    fs.closeSync(fd);
}

const client = new Discord.Client();

function grabChannels() {
    return client.channels.cache.filter(channel => channel.type === "voice");
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

function getLoggingChannel() {
    if (!this.loggingChannel) {
        this.loggingChannel = client.channels.cache.get(config.loggingChannelId);
    }

    return this.loggingChannel;
}

function log(msg) {
    console.log(msg);
    getLoggingChannel().send(msg, {split: true});
}

function err(msg) {
    console.error(msg);
    getLoggingChannel().send(`@everyone, I had a stronk:\n${typeof(msg) === 'string' ? msg : JSON.stringify(msg)}`,
        {split: true, code: true}
    );
}

function findGuildConfig(guildId) {
    if (!config.guilds[guildId]) {
        config.guilds[guildId] = JSON.parse(JSON.stringify(config.guilds._default));
    }
    if (!config.guilds[guildId].dynamic) config.guilds[guildId].dynamic = {};
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

async function getSongName(songId, callback) {
    await https.get(util.format(googleApi, songId, config.googleToken), res => {
        res.setEncoding('utf8');
        let response = "";
        res.on('data', data => {
            response += data;
        });
        res.on('error', () => {
            err("Error while getting song name");
            callback(undefined, true);
        });
        res.on('end', () => {
            callback(JSON.parse(response).items[0].snippet.title, false);
        });
    });
}

function playSong(conn, song) {
    log(`Playing ${song.title} in ${conn.channel.name} (in ${conn.channel.guild})`);
    if ('file' in song) {
        return conn.play(song.file, config.voiceStreamOptions);
    } else if ('ytdl' in song) {
        return conn.play(ytdl(song.ytdl, config.ytdlOptions), config.voiceStreamOptions);
    } else {
        err(`Don't know how to play ${JSON.stringify(song)}`);
        return undefined;
    }
}

function disconnect(channel, connection, guildp) {
    log(`Disconnecting from ${channel.name} (in ${channel.guild})`);

    let guild = guildp || findGuildConfig(channel.guild.id);

    let conn = connection || channel.connection || guild.dynamic.connection;
    if (conn) {
        conn.disconnect();
    } else {
        log(`Not disconnecting from ${channel.name} (in ${channel.guild}); connection handle was lost`);
    }

    channel.leave();

    delete guild.dynamic.connection;
    playing_guilds.delete(channel.guild.id);
}

async function play(channel, connection, song) {
    let guild = findGuildConfig(channel.guild.id);
    connection = connection || channel.connection || guild.dynamic.connection;

    if (guild.blacklist.contains(channel.name)) {
        log(`Channel ${channel.name} is blacklisted`);
        disconnect(channel, connection, guild);
        return;
    }

    if (!connection || connection.status !== 0) {
        if (playing_guilds.has(channel.guild.id)) {
            log(`Already playing on ${channel.guild}`);
            return;
        }

        log(`Joining ${channel.name} (in ${channel.guild})`);
        connection = await channel.join();
    }
    if (connection.dispatcher) {
        guild.dynamic.playEndedDispatcher = true;
        connection.dispatcher.end();
    }

    song = song || findSong(channel.guild.id);
    let dispatcher = playSong(connection, song);
    if (!dispatcher) return;

    guild.currentlyPlaying = song;
    guild.dynamic.connection = connection;

    playing_guilds.add(channel.guild.id);
    dispatcher.setVolume(1);
    dispatcher.on('finish', () => {
        if (guild.dynamic.playEndedDispatcher) {
            guild.dynamic.playEndedDispatcher = false;
            return;
        }
        if ((guild.radio && connection.status !== 4 /* DISCONNECTED */) || guild.dynamic.nextEndedDispatcher) {
            log(`Song ended/DC-ed, continuing in radio mode in ${connection.channel.name} (in ${connection.channel.guild})`);
            guild.dynamic.nextEndedDispatcher = false;
            play(channel, connection);
        } else {
            log(`Song ended/DC-ed, disconnecting from ${connection.channel.name} (in ${connection.channel.guild})`);
            disconnect(channel, connection, guild);
        }
    });
}

async function doReply(msg, reply) {
    let identifyingRoles = msg.member.roles.cache
            .filter(role => role.mentionable && role.members.size === 1);

    if (identifyingRoles.size) {
        return msg.channel.send(
            '<@&' + identifyingRoles.random().id + '>, ' + reply.replace(/^[ ]*/, ''),
            {split: true}
        );
    }

    // If the code comes to here, there is no unique role for the member, thus simply replying.
    await msg.reply(reply);
}

function playForUser(user) {
    grabChannels()
            .filter(channel => channel.members.has(user.id))
            .forEach(ch => play(ch).catch(err));
}

client.on('ready', () => {
    config.userId = client.user.id;
    log(`Logged in as ${client.user.tag}!`);

    var previous_empty = [];
    var empty_channels = [];
    setInterval(() => {
        previous_empty = [];
        empty_channels.forEach(channel => previous_empty.push(channel));
        empty_channels = [];
        grabChannels().forEach(channel => {
            if (channel['members'].size === 1 && channel['members'].get(config.userId) !== undefined) {
                log(`I'm the only one left in ${channel.name} (in ${channel.guild})`);
                disconnect(channel);
            }

            if (channel['members'].size === 0) {
                empty_channels.push(channel);
            }
        });
        previous_empty.diff(empty_channels).forEach(channel => {
            log(`Target acquired in ${channel.name} (in ${channel.guild})`);
            play(channel).catch(err);
        });

    }, 100);
});

let commands = [
    {
        regex: /^herlaad configuratie$/,
        simple: 'herlaad configuratie',
        help: 'Geike herlaadt haar instellingen',
        guild: '518091238524846131',
        action: msg => {
            if (fs.existsSync(configLocation)) {
                let configFile = fs.readFileSync(configLocation, { encoding: 'utf8' });
                config = JSON.parse(configFile);
                msg.react('👍').catch(err);
            } else {
                msg.react('👎').catch(err);
            }
        }
    },
    {
        regex: /^geef configuratie weer$/,
        simple: 'geef configuratie weer',
        help: 'Geike laat haar instellingen zien',
        guild: '518091238524846131',
        action: msg => {
            let censoredConfig = {};
            Object.assign(censoredConfig, config);
            delete censoredConfig.googleToken;
            delete censoredConfig.loginToken;
            msg.channel.send(JSON.stringify(censoredConfig, null, 2), {split: true, code: 'json'}).catch(err);
        }
    },
    {
        regex: /^(?:k[ua]n|wil) je (dit|[^ ]+) (?:ook|alsjeblieft)*\s+(soms|vaak|zelden|nooit(?: meer)?|niet(?: meer)?) spelen[:\? ]*(.*)$/,
        simple: 'kun je dit ook {vaak | soms | zelden | niet} spelen [YOUTUBE LINK _of_ TITEL]',
        help: 'Geike voegt een nieuw nummer aan haar bibliotheek toe, verandert hoe vaak ze het nummer zingt, of haalt het nummer uit haar bibliotheek',
        action: (msg, info, guild) => {
            let songId = (info[1] === 'dit' && info[3]) ? info[3] : info[1];
            let prob = info[2];

            function reprobSong(song) {
                let oldProb = song.p;
                song.p = prob;
                guild.songsTotal -= frequencies[oldProb];
                guild.songsTotal += frequencies[prob];
            }

            function yeetSong(song) {
                guild.songs.remove(song);
                guild.songsTotal -= frequencies[song.p];
            }

            switch (prob) {
              case "vaak":
              case "soms":
              case "zelden":
                if (songId === 'dit' && guild.currentlyPlaying) {
                    if (guild.songs.some(song => song === guild.currentlyPlaying)) {
                        reprobSong(guild.currentlyPlaying);
                    }
                    doReply(msg, `Oké, ik ga het ${prob} spelen!`).catch(err);
                } else if (ytdl.validateURL(songId)) {
                    getSongName(ytdl.getURLVideoID(songId), (songName, error) => {
                        if (error) {
                            doReply(msg, "Er is iets mis gegaan bij het ophalen van de naam van dit liedje!").catch(err);
                            return
                        }

                        let existingSong = guild.songs.find(song => song.ytdl === songId);
                        if (existingSong) {
                            reprobSong(existingSong);
                        } else {
                            guild.songs.push({title: songName, p: prob, ytdl: songId});
                            guild.songsTotal += frequencies[prob];
                        }
                        doReply(msg, `Oké, ik ga het ${prob} spelen!`).catch(err);
                    }).catch(err);
                } else {
                    let existingSong = guild.songs.find(song => song.title === songId);
                    if (existingSong) {
                        reprobSong(existingSong);
                        doReply(msg, `Oké, ik ga het ${prob} spelen!`).catch(err);
                    } else {
                        doReply(msg, "Ik weet niet welk nummer je bedoelt.").catch(err);
                    }
                }
                break;
              case "nooit":
              case "nooit meer":
              case "niet":
              case "niet meer":
                if (songId === 'dit' && guild.currentlyPlaying) {
                    if (guild.songs.some(song => song === guild.currentlyPlaying)) {
                        yeetSong(guild.currentlyPlaying);
                    }
                    doReply(msg, "Oké, ik ga het niet meer spelen!").catch(err);
                } else if (ytdl.validateURL(songId)) {
                    let existingSong = guild.songs.find(song => song.ytdl === songId);
                    if (existingSong) yeetSong(existingSong);
                    doReply(msg, "Oké, ik ga het niet meer spelen!").catch(err);
                } else {
                    let existingSong = guild.songs.find(song => song.title === songId);
                    if (existingSong) {
                        yeetSong(existingSong);
                        doReply(msg, "Oké, ik ga het niet meer spelen!").catch(err);
                    } else {
                        doReply(msg, "Ik weet niet welk nummer je bedoelt.").catch(err);
                    }
                }
                break;
            }

            saveConfig();
        }
    },
    {
        regex: /^(stop|STOP)( met spelen)?[1!]*$/,
        simple: 'stop!',
        help: 'Geike stopt met spelen als ze in een channel zit',
        action: (msg, _m, guild) => {
            if (!guild.dynamic.connection) {
                playing_guilds.delete(msg.channel.guild.id);
                msg.react('🤐').catch(err);
                return;
            }
            msg.react('🙄').catch(err);
            doReply(msg, 'Oké 😞').catch(err);
            disconnect(guild.dynamic.connection.channel, undefined, guild);
        }
    },
    {
        regex: /^(help|HELP|HELLUP)[!1]*$/,
        simple: 'help',
        help: 'Geike legt uit wat ze allemaal kan',
        action: (msg, _m, guild, commands) => {
            doReply(msg, "\n" + commands
                .filter(cmd => (!cmd.guild || cmd.guild === msg.guild.id) && cmd.help)
                .map(cmd => guild.cmdPrefix + ' ' + cmd.simple + ' ➡️ ' + cmd.help.replace('!geike', guild.cmdPrefix))
                .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
                .join('\n')
            ).catch(err);
        }
    },
    {
        regex: /^(fluister|zachter|ZACHTER|STILTE)[!1]*$/,
        simple: '{fluister|zachter}',
        help: 'Geike zal zich proberen iets meer in toom te houden',
        action: (msg, _m, guild) => {
            const connection = guild.dynamic.connection;
            const channel = connection.channel;

            let dispatcher = connection.dispatcher;
            if (!dispatcher) return;

            if (dispatcher.volume === 0.5) {
                doReply(msg, 'Ik ben al zo stil als ik kan zijn').catch(err);
            } else if (dispatcher.volume === 1) {
                doReply(msg, 'Ik zal zachter proberen te zijn').catch(err);
                dispatcher.setVolume(0.5);
            } else if (dispatcher.volume === 2) {
                doReply(msg, 'Ik zal stoppen met schreeuwen').catch(err);
                dispatcher.setVolume(1);
            }
        }
    },
    {
        regex: /^(harder|HARDER|SCHREEUW)[!1]*$/,
        simple: 'SCHREEUW',
        help: 'Geike laat luidkeels haar fantastische geluid horen',
        action: (msg, _m, guild) => {
            const connection = guild.dynamic.connection;
            const channel = connection.channel;

            let dispatcher = connection.dispatcher;
            if (!dispatcher) return;

            if (dispatcher.volume === 2) {
                doReply(msg, 'Ik schreeuw al zo hard als ik kan').catch(err);
            } else if (dispatcher.volume === 1) {
                doReply(msg,'Ik zal zo hard schreeuwen als ik kan').catch(err);
                dispatcher.setVolume(2);
            } else if (dispatcher.volume === 0.5) {
                doReply(msg, 'Ik zal wat luider zijn').catch(err);
                dispatcher.setVolume(1);
            }
        }
    },
    {
        regex: /^kartoffelschnaps$/,
        guild: '210075118716715019',
        action: msg => msg.react(msg.guild.emojis.get('567418410384883788'))
    },
    {
        regex: /^waar ben je$/,
        simple: 'waar ben je',
        help: 'Geike vertelt op welke server ze draait',
        guild: '518091238524846131',
        action: msg => doReply(msg, os.hostname()).catch(err)
    },
    {
        regex: /^luister (teef|bitch)$/,
        action: msg => {
            msg.react('😡').catch(err);
            msg.react('🖕').catch(err);
        }
    },
    {
        regex: /^wat k[ua]n je (allemaal )?spelen[\?]*$/,
        simple: 'wat kan je allemaal spelen',
        help: 'Geike stuurt een lijst van alles dat ze kan spelen en hoe vaak',
        action: (msg, _m, guild) => {
            function makeEmbed(i, num) {
                return new Discord.MessageEmbed()
                  .setColor([75, 83, 75])
                  .setTitle('Nummers die ik kan spelen')
                  .setFooter(`Ik kan ${guild.songs.length} nummers spelen${num > 1 ? `${i + 1}/${num}` : ''}`);
            }

            function formatSong(s) {
                return `${s.title} — ${s.p} (${(frequencies[s.p] / guild.songsTotal * 100).toFixed()}%)`;
            }

            let subsonglists = [''];
            for (let song of guild.songs) {
                fmtSong = formatSong(song);
                if (subsonglists[subsonglists.length - 1].length + fmtSong.length < 2000) {
                    subsonglists[subsonglists.length - 1] += '\n' + fmtSong;
                } else {
                    subsonglists.push(fmtSong);
                }
            }

            for (let songlist of subsonglists) {
                msg.channel.send({embed: makeEmbed().setDescription(songlist)}).catch(err);
            }
        }
    },
    {
        regex: /^kom (terug|hier)$/,
        simple: 'kom {terug | hier}',
        help: 'Geike komt (terug) in je huidige kanaal en begint opnieuw met spelen',
        action: msg => playForUser(msg.author)
    },
    {
        regex: /^zing alsjeblieft niet in (.*)$/,
        simple: 'zing alsjeblieft niet in {channel}',
        help: 'Geike zal niet meer haar zangkunsten vertonen in dit channel',
        action: (msg, chanInfo, guild) => {
            let chan = chanInfo[chanInfo.length - 1];
            let channel = grabChannels().find(ch => ch.guild.id === msg.guild.id && ch.name === chan);
            if (channel) {
                if (guild.blacklist.indexOf(chan) === -1) {
                    guild.blacklist.push(chan);
                    log(`Blacklisted from channel with members ${channel.members.array()}`);
                    if (channel.members.has(config.userId)) {
                        disconnect(channel);
                    }
                    msg.react('😢').catch(err);
                    doReply(msg, 'Oké, ik zal niet meer in ' + chan + ' zingen').catch(err);
                } else {
                    doReply(msg, 'ik mocht daar al niet meer zingen van iemand 🙄').catch(err);
                }
            } else {
                log(`The channel that was trying to be reached was ${chan}`);
                doReply(msg, 'ik begrijp niet welk kanaal je bedoelt met ' + chan).catch(err);
            }
        }
    },
    {
        regex: /^ik ben blij dat je hier bent in (.*)$/,
        simple: 'ik ben blij dat je hier bent in {channel}',
        help: 'Geike mag weer in dit channel zingen',
        action: (msg, chanInfo, guild) => {
            let chan = chanInfo[chanInfo.length - 1];
            if (grabChannels().some(ch => ch.name === chan)) {
                const idx = guild.blacklist.indexOf(chan);
                if (idx !== -1) {
                    guild.blacklist.splice(idx, 1);
                    doReply(msg, 'Ik zal mijn zangkunsten weer komen vertonen in ' + chan).catch(err);
                } else {
                    doReply(msg, 'Ik dacht dat ik nog in ' + chan + ' mocht spelen 😳').catch(err);
                }
            } else {
                log(`The channel that was trying to be reached was ${chan}`);
                doReply(msg, 'ik begrijp niet welk kanaal je bedoelt met ' + chan).catch(err);
            }
        }
    },
    {
        regex: /^(zet de radio aan|blijf spelen)$/,
        simple: 'blijf spelen',
        help: 'Geike blijft de hele tijd spelen. Vindt ze leuk',
        action: (msg, _m, guild) => {
            guild.radio = true;
            if (!guild.currentlyPlaying) {
                playForUser(msg.author);
            }
            doReply(msg, "Oké, ik zal blijven spelen!").catch(err);
        }
    },
    {
        regex: /^zet de radio uit$/,
        simple: 'zet de radio uit',
        help: 'Geike stopt met spelen na het huidige nummer',
        action: (msg, _m, guild) => {
            guild.radio = false;
            if (guild.currentlyPlaying) {
                doReply(msg, "Oké, ik zal hierna stoppen met spelen!").catch(err);
            } else {
                doReply(msg, "Oké, ik zal de volgende keer maar één nummer spelen!").catch(err);
            }
        }
    },
    {
        regex: /^(volgende|VOLGENDE)[1!]*$/,
        simple: 'volgende',
        help: 'Geike speelt een ander nummer',
        action: (msg, match, guild) => {
            function replyNotPlaying() {
                doReply(msg, 'Ik ben hier niet aan het spelen.').catch(err);
            }

            const conn = guild.dynamic.connection;
            if (!conn) {
                replyNotPlaying();
                return;
            }

            const dispatcher = conn.dispatcher;
            if (!dispatcher) {
                replyNotPlaying();
                return;
            }

            guild.dynamic.nextEndedDispatcher = true;
            dispatcher.end();

            if (match[1] === 'VOLGENDE') {
                doReply(msg, 'Het is voor de kerk lieverd').catch(err);
            }
        }
    },
    {
        regex: /^wat ben je op dit moment aan het spelen[?]*$/,
        simple: 'wat ben je op dit moment aan het spelen?',
        help: 'Geike zal vertellen welk nummer ze momenteel aan het spelen is',
        action: (msg, _m, guild) => {
            let currentlyPlaying = guild.currentlyPlaying;
            if (currentlyPlaying) {
                doReply(msg, `Ik ben momenteel ${currentlyPlaying.title} aan het spelen. Ik speel dit ${currentlyPlaying.p}.`).catch(err);
            } else {
                doReply(msg, 'Ik ben momenteel niet aan het spelen').catch(err);
            }
        }
    },
    {
        regex: /^braaf$/,
        simple: 'braaf',
        help: 'Geike vindt het leuk als je haar braaf noemt',
        action: msg => {
            msg.react('🐶').catch(err);
        }
    },
    {
        regex: /^kan je dit spelen (.*)$/,
        simple: 'kan je dit spelen {titel}',
        help: 'Geike gaat dat lied spelen als ze het kent',
        action: (msg, match, guild) => {
            let currentlyPlaying = guild.currentlyPlaying;
            let songTitle = match[1].trim();
            let song = guild.songs.find(song => song.title.trim() === songTitle);
            if (!currentlyPlaying) {
                doReply(msg, 'Ik ben momenteel nergens aan het spelen').catch(err);
            } else if (currentlyPlaying.title === songTitle){
                doReply(msg, 'Ik ben momenteel al ' + songTitle + ' aan het spelen').catch(err);
            } else if (!song) {
                doReply(msg, 'Ik ken het lied ' + songTitle + ' niet').catch(err);
            } else {
                grabChannels().forEach(channel => {
                    if (channel['members'].get(config.userId) !== undefined) {
                        play(channel, undefined, song).catch(err);
                    }
                });
            }
        }
    },
    {
        regex: /^luister voortaan naar (.*)$/,
        simple: 'luister voortaan naar {naam}',
        help: 'Geike luistert voortaan naar de nieuwe naam in plaats van !geike',
        action: (msg, match, guild) => {
            let newName = match[1].trim();
            if (newName) {
                guild.cmdPrefix = newName;
                doReply(msg, `Oké, voortaan luister ik naar ${newName}`).catch(err);
            } else {
                doReply(msg, "Dat is geen naam waar ik naar kan luisteren").catch(err);
            }
        }
    },
    {
        regex: /^in welke guilds speel je nu[\?]?$/,
        simple: 'in welke guilds speel je nu?',
        help: 'Geike vertelt in welke guilds ze aan het spelen is',
        guild: '518091238524846131',
        action: msg => {
            doReply(msg, Array.from(playing_guilds).join('; ')).catch(err);
        }
    },
    {
        regex: /^(sterf|STERF)[1!]*$/,
        simple: 'sterf',
        help: 'Geike stopt met werken',
        guild: '518091238524846131',
        action: () => {
            process.kill(process.pid);
        }
    }
];

const magicCommands = [
    {
        regex: /^omw$/,
        guild: f00fGuildId,
        action: msg => {
            doReply(msg, 'Auke stijl?').catch(err);
        }
    }
];

function tryCommands(comms, guildId, cmdString, msg, guild) {
    return comms
        .filter(cmd => !cmd.guild || cmd.guild === guildId)
        .map(cmd => {
            let match = cmd.regex.exec(cmdString);
            if (!match) return false;

            try {
                cmd.action(msg, match, guild, comms);
            } catch (ex) {
                err(ex.stack);
            }

            return true;
        })
        .some(r => r);
}

// When adding a new command to Geike, please also add that command to the 'help' constant.
client.on('message', msg => {
    let guildId = msg.guild.id;
    let guild = findGuildConfig(guildId);

    const magicCmdString = msg.content.trim();
    const anyMagicSucceeded = tryCommands(magicCommands, guildId, magicCmdString, msg, guild);

    if (!guild.cmdPrefix) guild.cmdPrefix = '!geike';
    if (!msg.content.startsWith(guild.cmdPrefix + ' ') || msg.author.id === config.userId) return;

    let cmdString = msg.content.substring(guild.cmdPrefix.length).trim();
    let anySucceeded = tryCommands(commands, guildId, cmdString, msg, guild);

    if (!anySucceeded && !anyMagicSucceeded) doReply(msg, "Ik weet niet wat je daarmee bedoelt...").catch(err);
});
client.login(config.loginToken).catch(err);

process.on('SIGTERM', () => {
    saveConfig();

    client.destroy().then(() => process.exit(0));
});

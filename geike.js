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

function disconnect(channel, connection, guildp) {
    console.log("disconnecting from " + channel.name + " (" + channel.guild + ")");

    let guild = guildp || findGuildConfig(channel.guild.id);

    let conn = connection || channel.connection;
    if (conn) {
        conn.disconnect();
    }

    delete guild.currentlyPlaying;
    playing_guilds.remove(channel.guild);
}

async function play(channel, connection) {
    let guild = findGuildConfig(channel.guild.id);

    if (guild.blacklist.contains(channel.name)) {
        console.log('This channel is blacklisted');
        disconnect(channel, connection, guild);
        return;
    }

    if (!connection) {
        if (playing_guilds.contains(channel.guild)) {
            console.log("Already playing on " + channel.guild);
            return;
        }

        connection = await channel.join();
        console.log("Joining " + connection.channel.name + " (" + connection.channel.guild + ")");
    }

    let song = findSong(channel.guild.id);
    let dispatcher = playSong(connection, song);
    if (!dispatcher) return;

    guild.currentlyPlaying = song;

    playing_guilds.push(channel.guild);
    dispatcher.setVolume(1);
    dispatcher.on('end', reason => {
        console.log("Song ended/DC-ed, disconnecting from " + connection.channel.name + " (" + connection.channel.guild + ") with reason " + reason);
        dispatcher.destroy();

        if (guild.radio && connection.status !== 4 /* DISCONNECTED */) {
            play(channel, connection);
        } else {
            disconnect(channel, connection, guild);
        }
    });
}

async function doReply(msg, reply) {
    let identifyingRoles = msg.member.roles
            .filter(role => role.mentionable && role.members.size == 1);

    if (identifyingRoles.size) {
        msg.channel.send(
            '<@&' + identifyingRoles.random().id + '>, ' + reply.replace(/^[ ]*/, ''),
            {split: true}
        );
        return;
    }

    // If the code comes to here, there is no unique role for the member, thus simply replying.
    msg.reply(reply);
}

function playForUser(user) {
    grabChannels()
            .filter(channel => channel.members.has(user.id))
            .forEach(ch => play(ch));
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
                let configFile = fs.readFileSync(configLocation, {encoding: 'utf8'});
                config = JSON.parse(configFile);
                msg.react('👍');
            } else {
                msg.react('👎');
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
            delete censoredConfig.loginToken;
            doReply(msg, JSON.stringify(censoredConfig, null, 2));
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
                    doReply(msg, "Oké, ik ga het " + prob + " spelen!");
                } else if (ytdl.validateURL(songId)) {
                    let existingSong = guild.songs.find(song => song.ytdl === songId);
                    if (existingSong) {
                        reprobSong(existingSong);
                    } else {
                        guild.songs.push({title: ytdl.getURLVideoID(songId), p: prob, ytdl: songId});
                        guild.songsTotal += frequencies[prob];
                    }
                    doReply(msg, "Oké, ik ga het " + prob + " spelen!");
                } else {
                    let existingSong = guild.songs.find(song => song.title === songId);
                    if (existingSong) {
                        reprobSong(existingSong);
                        doReply(msg, "Oké, ik ga het " + prob + " spelen!");
                    } else {
                        doReply(msg, "Ik weet niet welk nummer je bedoelt.");
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
                    doReply(msg, "Oké, ik ga het niet meer spelen!");
                } else if (ytdl.validateURL(songId)) {
                    let existingSong = guild.songs.find(song => song.ytdl === songId);
                    if (existingSong) yeetSong(existingSong);
                    doReply(msg, "Oké, ik ga het niet meer spelen!");
                } else {
                    let existingSong = guild.songs.find(song => song.title === songId);
                    if (existingSong) {
                        yeetSong(existingSong);
                        doReply(msg, "Oké, ik ga het niet meer spelen!");
                    } else {
                        doReply(msg, "Ik weet niet welk nummer je bedoelt.");
                    }
                }
                break;
            }
        }
    },
    {
        regex: /^(stop|STOP)( met spelen)?[1!]*$/,
        simple: 'stop!',
        help: 'Geike stopt met spelen als ze in een channel zit',
        action: msg => {
            msg.guild.channels.forEach(channel => {
                if (channel.type === "voice" && channel['members'].get(config.userId)) {
                    msg.react('🙄');
                    doReply(msg, 'Oké 😞');
                    disconnect(channel);
                }
            });
        }
    },
    {
        regex: /^(help|HELP|HELLUP)[!1]*$/,
        simple: 'help',
        help: 'Geike legt uit wat ze allemaal kan',
        action: (msg, _m, guild, commands) => {
            doReply(msg, "\n" + commands
                .filter(cmd => (!cmd.guild || cmd.guild == msg.guild.id) && cmd.help)
                .map(cmd => guild.cmdPrefix + ' ' + cmd.simple + ' ➡️ ' + cmd.help)
                .sort((a, b) => a.toLowerCase() < b.toLowerCase())
                .join('\n')
            );
        }
    },
    {
        regex: /^(fluister|zachter|ZACHTER|STILTE)[!1]*$/,
        simple: '{fluister|zachter}',
        help: 'Geike zal zich proberen iets meer in toom te houden',
        action: msg => {
            msg.guild.channels.forEach(channel => {
                if (channel.type !== 'voice' || !channel['members'].get(config.userId)) return;

                let conn = channel.connection;
                if (!conn) return;

                let dispatcher = conn.dispatcher;
                if (!dispatcher) return;

                if (dispatcher.volume === 0.5) {
                    doReply(msg, 'Ik ben al zo stil als ik kan zijn');
                } else if (dispatcher.volume === 1) {
                    doReply(msg, 'Ik zal zachter proberen te zijn');
                    dispatcher.setVolume(0.5);
                } else if (dispatcher.volume === 2) {
                    doReply(msg, 'Ik zal stoppen met schreeuwen');
                    dispatcher.setVolume(1);
                }
            });
        }
    },
    {
        regex: /^(harder|HARDER|SCHREEUW)[!1]*$/,
        simple: 'SCHREEUW',
        help: 'Geike laat luidkeels haar fantastische geluid horen',
        action: msg => {
            msg.guild.channels.forEach(channel => {
                if (channel.type !== 'voice' || !channel['members'].get(config.userId)) return;

                let conn = channel.connection;
                if (!conn) return;

                let dispatcher = conn.dispatcher;
                if (!dispatcher) return;

                if (dispatcher.volume === 2) {
                    doReply(msg, 'Ik schreeuw al zo hard als ik kan');
                } else if (dispatcher.volume === 1) {
                    doReply(msg,'Ik zal zo hard schreeuwen als ik kan');
                    dispatcher.setVolume(2);
                } else if (dispatcher.volume === 0.5) {
                    doReply(msg, 'Ik zal wat luider zijn')
                    dispatcher.setVolume(1);
                }
            });
        }
    },
    {
        regex: /^kartoffelschnaps$/,
        guild: '210075118716715019',
        action: msg => msg.react(msg.guild.emojis.get('557997588482228255'))
    },
    {
        regex: /^waar ben je$/,
        simple: 'waar ben je',
        help: 'Geike vertelt op welke server ze draait',
        guild: '518091238524846131',
        action: msg => doReply(msg, os.hostname())
    },
    {
        regex: /^luister (teef|bitch)$/,
        action: msg => {
            msg.react('😡').catch(console.error);
            msg.react('🖕').catch(console.error);
        }
    },
    {
        regex: /^wat k[ua]n je (allemaal )?spelen[\?]*$/,
        simple: 'wat kan je allemaal spelen',
        help: 'Geike stuurt een lijst van alles dat ze kan spelen en hoe vaak',
        action: (msg, _m, guild) => {
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
            let channel = grabChannels().find(ch => ch.name === chan);
            if (channel) {
                if (guild.blacklist.indexOf(chan) === -1) {
                    guild.blacklist.push(chan);
                    if (channel.members.has(config.userId)) {
                        disconnect(channel);
                    }
                    msg.react('😢').catch(console.error);
                    doReply(msg, 'Oké, ik zal niet meer in ' + chan + ' zingen');
                } else {
                    doReply(msg, 'ik mocht daar al niet meer zingen van iemand 🙄');
                }
            } else {
                console.log('The channel that was trying to be reached was ' + chan);
                doReply(msg, 'ik begrijp niet welk kanaal je bedoelt met ' + chan);
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
                    doReply(msg, 'Ik zal mijn zangkunsten weer komen vertonen in ' + chan);
                } else {
                    doReply(msg, 'Ik dacht dat ik nog in ' + chan + ' mocht spelen 😳');
                }
            } else {
                console.log('The channel that was trying to be reached was ' + chan);
                doReply(msg, 'ik begrijp niet welk kanaal je bedoelt met ' + chan);
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
            doReply(msg, "Oké, ik zal blijven spelen!");
        }
    },
    {
        regex: /^zet de radio uit$/,
        simple: 'zet de radio uit',
        help: 'Geike stopt met spelen na het huidige nummer',
        action: (msg, _m, guild) => {
            guild.radio = false;
            if (guild.currentlyPlaying) {
                doReply(msg, "Oké, ik zal hierna stoppen met spelen!");
            } else {
                doReply(msg, "Oké, ik zal de volgende keer maar één nummer spelen!");
            }
        }
    },
    {
        regex: /^(volgende|VOLGENDE)[1!]*$/,
        simple: 'volgende',
        help: 'Geike zingt een ander nummer',
        action: (msg, match, guild) => {
            msg.guild.channels
                .filter(ch => ch.type === 'voice' && ch.members.has(config.userId))
                .forEach(ch => {
                    let conn = ch.connection;
                    if (!conn) return;

                    let dispatcher = conn.dispatcher;
                    if (!dispatcher) return;

                    dispatcher.end('next');
                });

            if (match[1] === 'VOLGENDE') {
                doReply(msg, 'Het is voor de kerk lieverd');
            }
        }
    }
];


// When adding a new command to Geike, please also add that command to the 'help' constant.
client.on('message', msg => {
    let guildId = msg.guild.id;
    let guild = findGuildConfig(guildId);
    if (!guild.cmdPrefix) guild.cmdPrefix = '!geike';

    if (!msg.content.startsWith(guild.cmdPrefix) || msg.author.id === config.userId) return;

    let cmdString = msg.content.substring(guild.cmdPrefix.length).trim();
    let anySucceeded = commands
        .filter(cmd => !cmd.guild || cmd.guild == guildId)
        .map(cmd => {
            let match = cmd.regex.exec(cmdString);
            if (!match) return false;

            cmd.action(msg, match, guild, commands);

            return true;
        })
        .some(r => r);

    if (!anySucceeded) doReply(msg, "Ik weet niet wat je daarmee bedoelt...");
});
client.login(config.loginToken);

process.on('SIGTERM', () => {
    let dupedConfig = {};
    Object.assign(dupedConfig, config);
    Object.values(dupedConfig.guilds).forEach(guild => delete guild.currentlyPlaying);
    fs.writeFileSync(configLocation, JSON.stringify(dupedConfig), {encoding: 'utf8'});

    client.destroy().then(() => process.exit(0));
});

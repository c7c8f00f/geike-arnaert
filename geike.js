const Discord = require('discord.js');
const ytdl = require('ytdl-core');

const client = new Discord.Client();

function grabChannels() {
    return client.channels.filter( channel => channel.type === "voice");
}

Array.prototype.diff = function(a) {
    return this.filter(function(i) {return a.indexOf(i) < 0;});
};

async function play(cid) {
    const connection = await client.channels.filter(channel => channel.type === "voice").filter(channel => channel['id'] === cid).first().join();
    console.log("Joining " + connection.channel.name + " (" + connection.channel.guild + ")");
    var dispatcher;

    if (Math.random() >= 0.30) {
        console.log("Playing Zoutelande");
        dispatcher = connection.playStream(
            ytdl('https://www.youtube.com/watch?v=N0OLEgc-Glk', {filter: 'audioonly'}));
    } else if (Math.random() >= 0.30) {
        console.log("Playing Frankfurt Oder");
        dispatcher = connection.playStream(
            ytdl('https://www.youtube.com/watch?v=Mg3CdijJe24', {filter: 'audioonly'}));
    } else if (Math.random() >= 0.5) {
        console.log("Playing Blof Grips");
        dispatcher = connection.playStream(
            ytdl('https://www.youtube.com/watch?v=b6vpW-21c0w', {filter: 'audioonly'}));
    } else {
        console.log("Playing OOF");
        dispatcher = connection.playStream(
            ytdl('https://www.youtube.com/watch?v=YMNY2NcSMm8', {filter: 'audioonly'}));
    }
    connection.on("debug", message => console.log(message))

    dispatcher.setVolume(1);
    dispatcher.on('end', reason => {
        console.log("Song ended/DC-ed, disconnecting from " + connection.channel.name + " (" + connection.channel.guild + ") with reason " + reason);
        connection.disconnect();
        dispatcher.destroy();
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
    var playing_channels = [];
    setInterval(() => {
        previous_empty = [];
        empty_channels.forEach(channel => previous_empty.push(channel));
        empty_channels = [];
        grabChannels().forEach(channel => {
            if (channel['members'].size === 1 && channel['members'].get('563365336758616094') !== undefined) {
                console.log("I'm the only one left in " + channel.name + " (" + channel.guild + ")");
                disconnect(channel)
            }

            if (channel['members'].size === 0) {
                empty_channels.push(channel);
            }
        });
        previous_empty.diff(empty_channels).forEach(channel => {
            console.log("Target acquired in " + channel.name + " (" + channel.guild + ")");
            play(channel['id']);
        });

    }, 1000);
});
client.login('NTYzMzY1MzM2NzU4NjE2MDk0.XKYQ7Q.vTfSFIObDiYp_2_EI2QnOlbE8YQ');

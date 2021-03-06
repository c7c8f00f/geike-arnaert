import fs from 'fs';
import fsPromises from 'fs/promises';
import process from 'process';
import Discord from 'discord.js';
import ssdeep from 'ssdeep.js';
import { parseISO } from 'date-fns';
import { loadConfig, storeConfig } from './config.js';
import Logger from './Logger.js';
import ChannelWatcher from './ChannelWatcher.js';
import GuildRepository from './GuildRepository.js';
import MessageHandler from './MessageHandler.js';
import MessageSender from './MessageSender.js';
import YouTube from './YouTube.js';
import SongPlayer from './SongPlayer.js';
import AddSongCommand from './command/AddSongCommand.js';
import DumpConfigCommand from './command/DumpConfigCommand.js';
import HostnameCommand from './command/HostnameCommand.js';
import InsultCommand from './command/InsultCommand.js';
import JoinCommand from './command/JoinCommand.js';
import KartoffelschnapsCommand from './command/KartoffelschnapsCommand.js';
import ListCommand from './command/ListCommand.js';
import NextSongCommand from './command/NextSongCommand.js';
import RemoveSongCommand from './command/RemoveSongCommand.js';
import StopCommand from './command/StopCommand.js';
import HelpCommand from './command/HelpCommand.js';
import HistoryCommand from './command/HistoryCommand.js';
import SongListSender from './SongListSender.js';
import PlaylistCommand from './command/PlaylistCommand.js';
import SongFinder from './SongFinder.js';
import PlayOverrideCommand from './command/PlayOverrideCommand.js';
import CurrentSongCommand from './command/CurrentSongCommand.js';
import BlacklistCommand from './command/BlacklistCommand.js';
import UnBlacklistCommand from './command/UnBlacklistCommand.js';
import ToggleRadioModeCommand from './command/ToggleRadioModeCommand.js';
import ThankCommand from './command/ThankCommand.js';
import VersionCommand from './command/VersionCommand.js';

let config = loadConfig();

const client = new Discord.Client();

client.on('ready', () => {
  const logger = new Logger(client, config.loggingChannelId);
  const guildRepo = new GuildRepository(config, logger, () => storeConfig(config, logger));
  const messageSender = new MessageSender();
  const youtube = new YouTube(config);
  const songPlayer = new SongPlayer(config, logger, youtube);
  const songFinder = new SongFinder(config, logger, youtube, messageSender);
  const cw = new ChannelWatcher(client, logger, guildRepo,
    /* onConnect */ channel => {
      const guild = guildRepo.find(channel.guild.id);
      songPlayer.init(guild);
      songPlayer.play(channel, guild).catch(e => logger.err(e));
    }, /* onDisconnect */ channel => {
      const guild = guildRepo.find(channel.guild.id);
      songPlayer.stop(guild);
      channel.leave();
    }
  );

  const songListSender = new SongListSender(logger, client);

  const commands = [
    new AddSongCommand(config, logger, messageSender, youtube, songPlayer, songFinder),
    new BlacklistCommand(config, logger, client, messageSender),
    new CurrentSongCommand(config, logger, client, messageSender),
    new DumpConfigCommand(config, logger),
    new HostnameCommand(config, logger, messageSender),
    new InsultCommand(config, logger, messageSender),
    new JoinCommand(config, logger, client, songPlayer, messageSender),
    new KartoffelschnapsCommand(config, logger),
    new ListCommand(config, logger, messageSender, songListSender),
    new NextSongCommand(config, logger, messageSender),
    new PlaylistCommand(config, logger, messageSender, songListSender),
    new PlayOverrideCommand(config, logger, messageSender, songPlayer, songFinder),
    new RemoveSongCommand(config, logger, messageSender, youtube, songFinder),
    new StopCommand(config, logger, songPlayer),
    new ToggleRadioModeCommand(config, logger, messageSender),
    new UnBlacklistCommand(config, logger, client, messageSender),
    new HistoryCommand(config, logger, songListSender),
    new ThankCommand(config, logger, messageSender),
    new VersionCommand(config, logger, messageSender),
  ];

  commands.push(new HelpCommand(config, logger, messageSender, commands));

  const messageHandler = new MessageHandler(config, logger, messageSender, guildRepo, commands, []);
  client.on('message', msg => messageHandler.handle(msg));

  let referencedCacheEntries = new Set();

  (async () => {
    for (let guild of Object.values(config.guilds)) {
      for (let song of guild.songs) {
        try {
          await songPlayer.cache(song);
        } catch (ex) {
          logger.err(ex);
        }

        if (!song.titleHash) {
          song.titleHash = ssdeep.digest(song.title.toLowerCase());
          console.log(`Hashed title ${song.title} to ${song.titleHash}`);
        }

        const cfp = songPlayer.getCacheFilePath(song);
        referencedCacheEntries.add(cfp);

        if (!song.timestamp) {
          fs.stat(cfp, (err, stats) => {
            if (err) return;
            song.timestamp = new Date(stats.mtimeMs);
          });
        } else {
          song.timestamp = parseISO(song.timestamp);
        }
      }
    }

    const cachePath = '/var/lib/geike/cache';
    const cacheFilenames = await fsPromises.readdir(cachePath);
    await Promise.all(
        cacheFilenames
            .map(f => `${cachePath}/${f}`)
            .filter(f => !referencedCacheEntries.has(f))
            .map(f => {
              console.log(`Removing stale cache entry ${f}`)
              return fsPromises.rm(f);
            })
    );
  })().catch(e => logger.err(e));

  logger.log(`Logged in as ${client.user.tag}!`);
  cw.start();

  const storeConfigTimer = setInterval(() => storeConfig(config), 15000);

  process.on('SIGTERM', () => {
      clearInterval(storeConfigTimer);
      cw.stop();
      client.destroy();
      process.exit();
  });
});

client.login(config.loginToken).catch(console.error);

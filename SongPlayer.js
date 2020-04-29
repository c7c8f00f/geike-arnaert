import crypto from 'crypto';
import prism from 'prism-media';
import fs from 'fs';
import stream from 'stream';
import { spawn } from 'child_process';

const CACHE_PATH = '/var/lib/geike/cache';

export default class SongPlayer {
  constructor(config, logger, youtube) {
    this.config = config;
    this.logger = logger;
    this.youtube = youtube;
  }

  init(guild) {
    delete guild.voicePipe;
    guild.voicePipe = new stream.PassThrough({ highWaterMark: 128 });
    guild.voicePipe.on('error', () => {
      if (guild.voiceConnection) guild.voiceConnection.disconnect();
      if (guild.currentChannel) guild.currentChannel.leave();
    })
  }

  async play(channel, guild) {
    if (!guild.voicePipe) return;

    // Validate the connection
    if (guild.voiceConnection && guild.voiceConnection.status !== 0 /* CONNECTED */) {
      if (guild.dispatcher) {
        try {
          guild.dispatcher.destroy(new Error('connection invalid'));
        } catch (ex) {
          // Ignore as connection is not salvageable
        }
      }

      try {
        guild.voiceConnection.disconnect();
      } catch (ex) {
        // Ignore as connection is not salvageable
      }
      delete guild.voiceConnection;
      delete guild.dispatcher;
    }

    // Connect and create a dispatcher linked to the voice source if necessary
    if (!guild.voiceConnection || !guild.dispatcher) {
      const conn = await channel.join();
      guild.voiceConnection = conn;

      const dispatcher = conn.play(guild.voicePipe, {
        type: 'opus',
        volume: false,
        plp: this.config.voiceStreamOptions.plp,
        fec: true,
        bitrate: 'auto'
      });

      // Handle dispatcher errors by resetting the connection
      dispatcher.on('error', err => {
        if (!guild.dispatcher) {
          this.logger.info(`Double dispatcher error ${err} in ${channel.guild}${channel}?`);
          return;
        }

        delete guild.dispatcher;

        this.logger.err(`Dispatcher encountered error ${err} in ${channel.guild}${channel}, resetting..`);

        try {
          guild.voiceConnection.disconnect();
        } catch (ex) {
          // Ignore, will reconnect later
        }

        delete guild.voiceConnection;

        this.play(channel, guild).catch(e => this.logger.err(e));
      });

      guild.dispatcher = dispatcher;
    }

    const handleError = (e) => {
      if (!e) e = {};
      delete guild.currentSong;
      delete guild.currentStream;
      if (e.message !== 'next' && e.message !== 'force stop' && e.message !== 'interrupt') {
        this.logger.err(e);
      }
      if (e.message !== 'force stop' && e.message !== 'interrupt') {
        setTimeout(() => {
          this.play(channel, guild).catch(e => this.logger.err(e));
        }, 1000);
      } else if (e.message !== 'interrupt') {
        delete guild.currentChannel;
        channel.leave()
      }
    };

    try {
      const playlist = guild.getPlaylist();
      const song = playlist.shift();
      this.logger.log(`Playing ${song.title} in ${channel.guild}${channel}`);
      const str = (await this._open(song)).pipe(new prism.opus.OggDemuxer());
      guild.currentSong = song;
      guild.currentStream = str;
      guild.currentChannel = channel;
      str.on('end', () => {
        if (guild.config.radio) {
          this.logger.log(`Song ended, continuing in radio mode in ${channel.guild}${channel}`);
          this.play(channel, guild).catch(e => this.logger.err(e));
        } else {
          this.logger.log(`Song ended, disconnecting from ${channel.guild}${channel}`);
          channel.leave();
        }
      });
      str.on('error', handleError);
      str.pipe(guild.voicePipe, { end: false });
    } catch (ex) {
      handleError(ex);
    }
  }

  stop(guild) {
    const vp = guild.voicePipe;
    if (!vp) return;
    delete guild.voicePipe;
    if (guild.currentStream) {
      guild.currentStream.destroy(new Error('force stop'));
    }
    vp.destroy(new Error('force stop'));
  }

  interrupt(guild) {
    if (guild.currentStream) {
      guild.currentStream.destroy(new Error('interrupt'));
    }
  }

  next(guild) {
    if (guild.currentStream) {
      guild.currentStream.destroy(new Error('next'));
    }
  }

  async cache(song) {
    const str = await this._open(song);
    str.on('error', () => {}); // Ignore the following destroy error
    str.destroy(new Error('caching done'));
  }

  isInCache(song) {
    return new Promise((resolve, reject) => {
      let path;
      try {
        let o = this._getSongPath(song);
        path = o.path;
      } catch (ex) {
        reject(ex);
      }

      const cachePath = this._getCacheFilePath(path);
      fs.access(cachePath, fs.constants.R_OK, err => {
        resolve(!err);
      });
    });
  }

  _getSongPath(song) {
    let path;
    let type;
    if ('file' in song) {
      path = song.file;
      type = 'file';
    } else if ('ytdl' in song) {
      path = song.ytdl;
      type = 'ytdl';
    } else {
      throw new Error('Unable to determine song source');
    }

    return { path, type };
  }

  _open(song) {
    return new Promise((resolve, reject) => {
      let path;
      let type;
      try {
        let o = this._getSongPath(song);
        path = o.path;
        type = o.type;
      } catch (ex) {
        reject(ex);
      }

      const cachePath = this._getCacheFilePath(path);
      this._openFile(cachePath, (err, fd) => {
        if (!err) {
          resolve(fs.createReadStream('', { fd, highWaterMark: 128 }));
          return;
        }

        this._cache(path, type, cachePath).then(() => {
          this.logger.log(`Cached ${path} as ${cachePath}`);
          this._openFile(cachePath, (err, fd) => {
            if (err) reject(err);
            else resolve(fs.createReadStream('', { fd, highWaterMark: 128 }));
          });
        }).catch(reject);
      });
    });
  }

  _openFile(path, cb) {
    fs.open(path, 'r', 0, cb);
  }

  _cache(path, type, cachePath) {
    this.logger.log(`Creating cache entry for ${type} ${path}`);
    if (type === 'file') {
      return this._transcodeFile(path, cachePath);
    } else if (type === 'ytdl') {
      try {
        return new Promise((resolve, reject) => {
          const vidStream = this.youtube.open(path);
          vidStream.on('error', e => reject(e));
          vidStream.on('info', () => this._transcodeStream(vidStream, cachePath).then(resolve));
        });
      } catch (ex) {
        return Promise.reject(ex);
      }
    } else {
      return Promise.reject('Unable to determine song source');
    }
  }

  _transcodeFile(path, target) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', path,
        '-c:a', 'libopus',
        '-b:a', '48000',
        '-packet_loss', `${this.config.voiceStreamOptions.plp * 100}`,
        target
      ], {
        stdio: 'inherit'
      });
      this.logger.log(`Spawned ${ffmpeg.spawnargs.join(' ')}`);
      ffmpeg.on('exit', code => code === 0 ? resolve() : reject(`ffmpeg failed with code ${code}`));
    });
  }

  _transcodeStream(stream, target) {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:',
        '-c:a', 'libopus',
        '-b:a', '48000',
        '-packet_loss', `${this.config.voiceStreamOptions.plp * 100}`,
        target
      ], {
        stdio: ['pipe', 'inherit', 'inherit']
      });
      this.logger.log(`Spawned ${ffmpeg.spawnargs.join(' ')}`);
      stream.pipe(ffmpeg.stdin);
      ffmpeg.on('exit', code => code === 0 ? resolve() : reject(`ffmpeg failed with code ${code}`));
    });
  }

  _getCacheFilePath(path) {
    const h = crypto.createHash('sha3-256');
    h.update(path);
    return `${CACHE_PATH}/${h.digest('hex')}.opus`;
  }
};

export default class Logger {
  constructor(client, loggingChannelId) {
    this.channel = client.channels.cache.get(loggingChannelId);
  }

  log(msg) {
    console.log(msg);
    this.channel.send(msg, { split: true }).catch(console.error);
  }

  err(msg) {
    console.trace();
    console.trace(msg);
    let msgStr;
    if (msg instanceof Error) {
      msgStr = `${msg.name}: ${msg.message}`;
    } else if (typeof(msg) === 'string') {
      msgStr = msg;
    } else {
      msgStr = JSON.stringify(msg);
    }
    this.channel.send(`@everyone, I had a stronk:\n${msgStr}`, { split: true });
  }
}

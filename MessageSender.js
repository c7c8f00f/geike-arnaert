export default class MessageSender {
  reply(msg, reply) {
    // Discord(.js)? is buggy and the unique-role-code kept @mentioning other people
    return msg.reply(reply);
  }
};

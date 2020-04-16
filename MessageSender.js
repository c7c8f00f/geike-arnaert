export default class MessageSender {
  reply(msg, reply) {
    const identifyingRoles = msg.member.roles.cache.filter(role => role.mentionable && role.members.size === 1);

    if (identifyingRoles.size) {
      return msg.channel.send(
        `<@&${identifyingRoles.random().id}>, ${reply.replace(/^[ ]*/, '')}`, { split: true }
      );
    }

    // If the code comes to here, there is no unique role for the member, thus simply replying.
    return msg.reply(reply);
  }
};

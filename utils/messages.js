function formatMessage(username, text, replyTo = null) {
  return {
    username,
    text,
    replyTo,
    id: Date.now(),
    reactions: {},
    file: null
  };
}

module.exports = formatMessage;
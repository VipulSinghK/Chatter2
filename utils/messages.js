const moment = require('moment');

function formatMessage(username, text, replyTo = null) {
  return {
    username,
    text,
    time: moment().utc().format('h:mm a [UTC]'),
    replyTo,
    id: Date.now()
  };
}

module.exports = formatMessage;
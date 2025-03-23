const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(path.join(__dirname, 'public')));

const botName = 'ChatBot';
const roomMessages = new Map();

io.on('connection', socket => {
  socket.on('joinRoom', ({ username, roomCode }) => {
    const user = userJoin(socket.id, username, roomCode);
    socket.join(user.room);

    if (!roomMessages.has(roomCode)) {
      roomMessages.set(roomCode, new Map());
    }

    socket.emit('roomJoined', { success: true, message: `Welcome to room ${roomCode}!` });
    socket.emit('message', formatMessage(botName, `Welcome to room ${roomCode}!`));
    socket.broadcast.to(user.room).emit(
      'message',
      formatMessage(botName, `${user.username} has joined the room`)
    );
    
    io.to(user.room).emit('usersList', getRoomUsers(user.room));
  });

  socket.on('chatMessage', ({ text, replyTo, roomCode }) => {
    const user = getCurrentUser(socket.id);
    if (user) {
      const message = replyTo
        ? formatMessage(user.username, text, replyTo)
        : formatMessage(user.username, text);
      const messages = roomMessages.get(roomCode);
      messages.set(message.id, message);
      io.to(roomCode).emit('message', message);
    }
  });

  socket.on('addReaction', ({ messageId, emoji, roomCode }) => {
    const user = getCurrentUser(socket.id);
    if (user) {
      const messages = roomMessages.get(roomCode);
      const message = messages.get(messageId);
      if (message) {
        message.reactions = message.reactions || {};
        message.reactions[emoji] = (message.reactions[emoji] || 0) + 1;
        io.to(roomCode).emit('messageUpdate', message);
      }
    }
  });

  socket.on('fileUpload', ({ file, filename, roomCode }) => {
    const user = getCurrentUser(socket.id);
    if (user) {
      const message = formatMessage(user.username, 'Shared a file: ' + filename);
      message.file = { data: file, filename };
      const messages = roomMessages.get(roomCode);
      messages.set(message.id, message);
      io.to(roomCode).emit('message', message);
    }
  });

  socket.on('typing', ({ username, roomCode }) => {
    socket.broadcast.to(roomCode).emit('userTyping', username);
  });

  socket.on('stopTyping', ({ username, roomCode }) => {
    socket.broadcast.to(roomCode).emit('userStopTyping', username);
  });

  socket.on('leaveRoom', ({ username, roomCode }) => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(roomCode).emit('message', formatMessage(botName, `${user.username} has left the room`));
      io.to(user.room).emit('usersList', getRoomUsers(user.room));
    }
  });

  socket.on('disconnect', () => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.room).emit('message', formatMessage(botName, `${user.username} has left the room`));
      io.to(user.room).emit('usersList', getRoomUsers(user.room));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const botName = 'ChatBot';

// Run when client connects
io.on('connection', socket => {
  socket.on('joinChat', (username) => {
    const user = userJoin(socket.id, username);

    // Welcome current user
    socket.emit('message', formatMessage(botName, 'Welcome to the Chat App!'));

    // Broadcast when a user connects
    socket.broadcast.emit(
      'message',
      formatMessage(botName, `${user.username} has joined the chat`)
    );

    // Send users info
    io.emit('usersList', getRoomUsers());
  });

  // Listen for chat message
  socket.on('chatMessage', (data) => {
    const user = getCurrentUser(socket.id);
    if (user) {
      const message = typeof data === 'string' 
        ? formatMessage(user.username, data)
        : formatMessage(user.username, data.text, data.replyTo);
      io.emit('message', message);
    }
  });

  // Typing events
  socket.on('typing', (username) => {
    socket.broadcast.emit('userTyping', username);
  });

  socket.on('stopTyping', (username) => {
    socket.broadcast.emit('userStopTyping', username); // Pass username here
  });

  // Runs when client disconnects
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);
    if (user) {
      io.emit(
        'message',
        formatMessage(botName, `${user.username} has left the chat`)
      );
      io.emit('usersList', getRoomUsers());
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
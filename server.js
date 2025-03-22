const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const formatMessage = require("./utils/messages");
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, "public")));

const botName = "ChatBot";

// Run when client connects
io.on("connection", (socket) => {
  socket.on("joinRoom", ({ username, roomCode }) => {
    const user = userJoin(socket.id, username, roomCode);
    socket.join(user.room);

    // Notify client of successful join
    socket.emit("roomJoined", {
      success: true,
      message: `Welcome to room ${roomCode}!`,
    });

    // Welcome current user
    socket.emit(
      "message",
      formatMessage(botName, `Welcome to room ${roomCode}!`)
    );

    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        formatMessage(botName, `${user.username} has joined the room`)
      );

    // Send users info for the room
    io.to(user.room).emit("usersList", getRoomUsers(user.room));
  });

  // Listen for chat message
  socket.on("chatMessage", ({ text, replyTo, roomCode }) => {
    const user = getCurrentUser(socket.id);
    if (user) {
      const message = replyTo
        ? formatMessage(user.username, text, replyTo)
        : formatMessage(user.username, text);
      io.to(roomCode).emit("message", message);
    }
  });

  // Typing events
  socket.on("typing", ({ username, roomCode }) => {
    socket.broadcast.to(roomCode).emit("userTyping", username);
  });

  socket.on("stopTyping", ({ username, roomCode }) => {
    socket.broadcast.to(roomCode).emit("userStopTyping", username);
  });

  // Handle leaving a room
  socket.on("leaveRoom", ({ username, roomCode }) => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(roomCode).emit(
        "message",
        formatMessage(botName, `${user.username} has left the room`)
      );
      io.to(roomCode).emit("usersList", getRoomUsers(user.room));
    }
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the room`)
      );
      io.to(user.room).emit("usersList", getRoomUsers(user.room));
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

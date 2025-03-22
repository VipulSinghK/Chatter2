const chatForm = document.getElementById("chat-form");
const chatMessages = document.getElementById("chat-messages");
const usersList = document.getElementById("users");
const usernameInput = document.getElementById("username");
const roomCodeInput = document.getElementById("room-code");
const joinBtn = document.getElementById("join-btn");
const msgInput = document.getElementById("msg");
const roomCodeDisplay = document.getElementById("room-code-display"); // New element for displaying code

// Initialize variables
let socket;
let username = "";
let roomCode = "";
let isJoined = false;
let isAdmin = false;

// Typing indicator
const typingIndicator = document.createElement("div");
typingIndicator.classList.add("message", "system", "typing");
let typingTimeout;
let currentTypingUser = null;

// Generate a unique room code (simple random string for demo; could use UUID in production)
function generateRoomCode() {
  // return "ROOM-" + Math.random().toString(36).substr(2, 6).toUpperCase();
  return Math.random().toString(36).substr(2, 6).toLowerCase();
}

// Join chat event
joinBtn.addEventListener("click", joinChat);

function joinChat() {
  username = usernameInput.value.trim();
  roomCode = roomCodeInput.value.trim();

  if (!username) {
    alert("Please enter a username");
    return;
  }

  if (!isJoined) {
    // Connect to socket.io
    socket = io();

    // If no room code provided, assume admin and generate one
    if (!roomCode) {
      isAdmin = true;
      roomCode = generateRoomCode();
      // roomCodeDisplay.innerText = `Your Room Code: ${roomCode} (Share this with others)`;
      const inviteLink = `${window.location.origin}/?roomId=${roomCode}`;
      roomCodeDisplay.innerHTML = `Invite Link: <a href="${inviteLink}" target="_blank">${inviteLink}</a> (Share this with others)`;
      roomCodeDisplay.style.display = "block";
      navigator.clipboard
        .writeText(inviteLink)
        .then(() => {
          alert("Invite link copied to clipboard!");
        })
        .catch((err) => {
          console.error("Failed to copy invite link: ", err);
        });
    }

    // Send username and room code to server
    socket.emit("joinRoom", { username, roomCode });

    // Handle room join response
    socket.on("roomJoined", ({ success, message }) => {
      if (success) {
        // Get users list for the room
        socket.on("usersList", (users) => {
          displayUsers(users);
        });

        // Message from server
        socket.on("message", (message) => {
          displayMessage(message);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        });

        // Typing events
        socket.on("userTyping", (usernameTyping) => {
          if (usernameTyping !== username) {
            currentTypingUser = usernameTyping;
            typingIndicator.innerText = `${usernameTyping} is typing...`;
            if (!chatMessages.contains(typingIndicator)) {
              chatMessages.appendChild(typingIndicator);
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
          }
        });

        socket.on("userStopTyping", (usernameTyping) => {
          if (
            usernameTyping === currentTypingUser &&
            chatMessages.contains(typingIndicator)
          ) {
            chatMessages.removeChild(typingIndicator);
            currentTypingUser = null;
          }
        });

        // Enable message input
        msgInput.disabled = false;
        joinBtn.textContent = "Leave Room";
        usernameInput.disabled = true;
        roomCodeInput.disabled = true;
        isJoined = true;

        // Setup chat form submission event
        chatForm.addEventListener("submit", sendMessage);

        // Typing event listener
        msgInput.addEventListener("input", () => {
          socket.emit("typing", { username, roomCode });
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(
            () => socket.emit("stopTyping", { username, roomCode }),
            1000
          );
        });
      } else {
        alert(message);
        socket.disconnect();
      }
    });
  } else {
    // Disconnect
    socket.emit("leaveRoom", { username, roomCode });
    socket.disconnect();

    // Reset UI
    joinBtn.textContent = "Join Room";
    usernameInput.disabled = false;
    roomCodeInput.disabled = false;
    msgInput.disabled = true;
    isJoined = false;
    isAdmin = false;
    roomCodeDisplay.style.display = "none";

    // Clear users list
    usersList.innerHTML = "";

    // Add system message
    const div = document.createElement("div");
    div.classList.add("message", "system");
    div.innerText = `You left the room with code ${roomCode}`;
    chatMessages.appendChild(div);

    // Remove event listener
    chatForm.removeEventListener("submit", sendMessage);
  }
}

// Send message to server
function sendMessage(e) {
  e.preventDefault();

  const msg = msgInput.value.trim();

  if (!msg) {
    return;
  }

  const replyMatch = msg.match(/^Replying to "(.+?)": (.+)$/);
  if (replyMatch) {
    socket.emit("chatMessage", {
      text: replyMatch[2],
      replyTo: { text: replyMatch[1] },
      roomCode,
    });
  } else {
    socket.emit("chatMessage", { text: msg, roomCode });
  }

  msgInput.value = "";
  msgInput.focus();
}

// Display message to DOM
function displayMessage(message) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.dataset.messageId = message.id || Date.now();

  if (message.username === username) {
    div.classList.add("user");
  } else if (message.username === "ChatBot") {
    div.classList.add("system");
  } else {
    div.classList.add("other");
  }

  if (message.replyTo) {
    const replyDiv = document.createElement("div");
    replyDiv.classList.add("reply-preview");
    replyDiv.innerText = `Replying to: ${message.replyTo.text}`;
    div.appendChild(replyDiv);
  }

  if (message.username !== "ChatBot") {
    const meta = document.createElement("div");
    meta.classList.add("meta");
    meta.innerHTML = `<span>${message.username}</span> <span>${message.time}</span>`;
    div.appendChild(meta);
  }

  const para = document.createElement("p");
  para.classList.add("text");
  para.innerText = message.text;
  div.appendChild(para);

  chatMessages.appendChild(div);

  // Add click to reply
  div.addEventListener("click", () => {
    msgInput.value = `Replying to "${message.text}": `;
    msgInput.focus();
  });
}

// Display users to DOM
function displayUsers(users) {
  usersList.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.innerText = user.username;
    usersList.appendChild(li);
  });
}

// Disable message input until joined
msgInput.disabled = true;

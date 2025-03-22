const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');
const usersList = document.getElementById('users');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('join-btn');
const msgInput = document.getElementById('msg');

// Initialize variables
let socket;
let username = '';
let isJoined = false;

// Typing indicator
const typingIndicator = document.createElement('div');
typingIndicator.classList.add('message', 'system', 'typing');
let typingTimeout;
let currentTypingUser = null; // Track who is typing

// Join chat event
joinBtn.addEventListener('click', joinChat);

function joinChat() {
  username = usernameInput.value.trim();
  
  if (!username) {
    alert('Please enter a username');
    return;
  }
  
  if (!isJoined) {
    // Connect to socket.io
    socket = io();
    
    // Send username to server
    socket.emit('joinChat', username);
    
    // Get users list
    socket.on('usersList', (users) => {
      displayUsers(users);
    });
    
    // Message from server
    socket.on('message', (message) => {
      displayMessage(message);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    
    // Typing events
    socket.on('userTyping', (usernameTyping) => {
      if (usernameTyping !== username) {
        currentTypingUser = usernameTyping;
        typingIndicator.innerText = `${usernameTyping} is typing...`;
        if (!chatMessages.contains(typingIndicator)) {
          chatMessages.appendChild(typingIndicator);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }
    });

    socket.on('userStopTyping', (usernameTyping) => {
      if (usernameTyping === currentTypingUser && chatMessages.contains(typingIndicator)) {
        chatMessages.removeChild(typingIndicator);
        currentTypingUser = null;
      }
    });
    
    // Enable message input
    socket.on('connect', () => {
      msgInput.disabled = false;
    });
    
    // Change button text
    joinBtn.textContent = 'Leave Chat';
    usernameInput.disabled = true;
    isJoined = true;
    
    // Setup chat form submission event
    chatForm.addEventListener('submit', sendMessage);
    
    // Typing event listener
    msgInput.addEventListener('input', () => {
      socket.emit('typing', username);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => socket.emit('stopTyping', username), 1000);
    });
  } else {
    // Disconnect
    socket.disconnect();
    
    // Reset UI
    joinBtn.textContent = 'Join Chat';
    usernameInput.disabled = false;
    msgInput.disabled = true;
    isJoined = false;
    
    // Clear users list
    usersList.innerHTML = '';
    
    // Add system message
    const div = document.createElement('div');
    div.classList.add('message', 'system');
    div.innerText = 'You left the chat';
    chatMessages.appendChild(div);
    
    // Remove event listener
    chatForm.removeEventListener('submit', sendMessage);
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
    socket.emit('chatMessage', {
      text: replyMatch[2],
      replyTo: { text: replyMatch[1] }
    });
  } else {
    socket.emit('chatMessage', msg);
  }
  
  msgInput.value = '';
  msgInput.focus();
}

// Display message to DOM
function displayMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.dataset.messageId = message.id || Date.now();
  
  if (message.username === username) {
    div.classList.add('user');
  } else if (message.username === 'ChatBot') {
    div.classList.add('system');
  } else {
    div.classList.add('other');
  }
  
  if (message.replyTo) {
    const replyDiv = document.createElement('div');
    replyDiv.classList.add('reply-preview');
    replyDiv.innerText = `Replying to: ${message.replyTo.text}`;
    div.appendChild(replyDiv);
  }
  
  if (message.username !== 'ChatBot') {
    const meta = document.createElement('div');
    meta.classList.add('meta');
    meta.innerHTML = `<span>${message.username}</span> <span>${message.time}</span>`;
    div.appendChild(meta);
  }
  
  const para = document.createElement('p');
  para.classList.add('text');
  para.innerText = message.text;
  div.appendChild(para);
  
  chatMessages.appendChild(div);
  
  // Add click to reply
  div.addEventListener('click', () => {
    msgInput.value = `Replying to "${message.text}": `;
    msgInput.focus();
  });
}

// Display users to DOM
function displayUsers(users) {
  usersList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerText = user.username;
    usersList.appendChild(li);
  });
}

// Disable message input until joined
msgInput.disabled = true;
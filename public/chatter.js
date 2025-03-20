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
      
      // Scroll down
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    
    // Enable message input
    socket.on('connect', () => {
        msgInput.disabled = false; // ✅ Now enabled when joined
      });
    // Change button text
    joinBtn.textContent = 'Leave Chat';
    usernameInput.disabled = true;
    isJoined = true;
    
    // Setup chat form submission event
    chatForm.addEventListener('submit', sendMessage);
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
  
  // Get message text
  const msg = msgInput.value.trim();
  
  if (!msg) {
    return;
  }
  
  // Emit message to server
  socket.emit('chatMessage', msg);
  
  // Clear input
  msgInput.value = '';
  msgInput.focus();
}

// Display message to DOM
function displayMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  
  if (message.username === username) {
    div.classList.add('user');
  } else if (message.username === 'ChatBot') {
    div.classList.add('system');
  } else {
    div.classList.add('other');
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
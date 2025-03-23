const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');
const usersList = document.getElementById('users');
const usernameInput = document.getElementById('username');
const roomCodeInput = document.getElementById('room-code');
const joinBtn = document.getElementById('join-btn');
const msgInput = document.getElementById('msg');
const roomCodeDisplay = document.getElementById('room-code-display');
const sidebarToggle = document.getElementById('sidebar-toggle');
const chatSidebar = document.querySelector('.chat-sidebar');
const welcomeCard = document.getElementById('welcome-card');
const chatContainer = document.getElementById('chat-container');
const nextBtn = document.getElementById('next-btn');
const skipBtn = document.getElementById('skip-btn');

let socket;
let username = '';
let roomCode = '';
let isJoined = false;
let isAdmin = false;
let currentSlide = 0;
const totalSlides = document.querySelectorAll('.welcome-slide').length;

const notificationSound = new Audio('/notification.mp3');

const typingIndicator = document.createElement('div');
typingIndicator.classList.add('message', 'system', 'typing');
let typingTimeout;
let currentTypingUser = null;

const fileBtn = document.createElement('button');
fileBtn.textContent = 'Upload File';
fileBtn.className = 'btn';
fileBtn.type = 'button';
let isFileBtnAdded = false;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

fileBtn.addEventListener('click', () => {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/*,.pdf';
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert('File size exceeds 10MB limit. Please upload a smaller file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          socket.emit('fileUpload', { 
            file: reader.result, 
            filename: file.name, 
            roomCode 
          });
          console.log(`Uploaded file: ${file.name}, Size: ${file.size} bytes`);
        } catch (error) {
          console.error('Error emitting fileUpload:', error);
          displaySystemMessage('Failed to upload file. Please try again.');
        }
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        displaySystemMessage('Error reading file. Please try again.');
      };
      reader.readAsDataURL(file);
    }
  };
  fileInput.click();
});

sidebarToggle.addEventListener('click', () => {
  chatSidebar.classList.toggle('active');
});

// Welcome Card Logic
nextBtn.addEventListener('click', () => {
  currentSlide++;
  if (currentSlide < totalSlides) {
    updateSlide();
  } else {
    showChatApp();
  }
});

skipBtn.addEventListener('click', () => {
  showChatApp();
});

function updateSlide() {
  document.querySelectorAll('.welcome-slide').forEach(slide => {
    slide.classList.remove('active');
    if (parseInt(slide.dataset.slide) === currentSlide) {
      slide.classList.add('active');
    }
  });
  document.querySelectorAll('.dot').forEach(dot => {
    dot.classList.remove('active');
    if (parseInt(dot.dataset.dot) === currentSlide) {
      dot.classList.add('active');
    }
  });
  nextBtn.textContent = currentSlide === totalSlides - 1 ? 'Get Started' : 'Next';
}

function showChatApp() {
  welcomeCard.style.animation = 'cardFadeOut 0.5s ease-in-out forwards';
  setTimeout(() => {
    welcomeCard.style.display = 'none';
    chatContainer.style.display = 'flex';
    chatContainer.style.animation = 'cardFadeIn 0.5s ease-in-out';
  }, 500); // Match animation duration
}

function generateRoomCode() {
  return 'ROOM-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

joinBtn.addEventListener('click', joinChat);

function joinChat() {
  username = usernameInput.value.trim();
  roomCode = roomCodeInput.value.trim();
  
  if (!username) {
    alert('Please enter a username');
    return;
  }
  
  if (!isJoined) {
    socket = io();
    
    socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
      displaySystemMessage('Connection error occurred.');
    });
    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      displaySystemMessage(`Disconnected from server: ${reason}`);
      cleanupAfterDisconnect();
    });

    if (!roomCode) {
      isAdmin = true;
      roomCode = generateRoomCode();
      roomCodeDisplay.innerText = `Your Room Code: ${roomCode} (Share this with others)`;
      roomCodeDisplay.style.display = 'block';
    }
    
    socket.emit('joinRoom', { username, roomCode });
    
    socket.on('roomJoined', ({ success, message }) => {
      if (success) {
        socket.on('usersList', (users) => {
          displayUsers(users);
        });
        
        socket.on('message', (message) => {
          if (message.username !== username) {
            notificationSound.play().catch(error => {
              console.log('Audio playback failed:', error);
            });
          }
          displayMessage(message);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        });
        
        socket.on('messageUpdate', (message) => {
          updateMessage(message);
        });
        
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
        
        msgInput.disabled = false;
        joinBtn.textContent = 'Leave Room';
        usernameInput.disabled = true;
        roomCodeInput.disabled = true;
        isJoined = true;
        
        chatForm.addEventListener('submit', sendMessage);

        if (!isFileBtnAdded) {
          chatForm.appendChild(fileBtn);
          isFileBtnAdded = true;
        }
        
        msgInput.addEventListener('input', () => {
          socket.emit('typing', { username, roomCode });
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => socket.emit('stopTyping', { username, roomCode }), 1000);
        });

        if (window.innerWidth <= 768) {
          chatSidebar.classList.remove('active');
        }
      } else {
        alert(message);
        socket.disconnect();
      }
    });
  } else {
    socket.emit('leaveRoom', { username, roomCode });
    socket.disconnect();
    cleanupAfterDisconnect();
  }
}

function sendMessage(e) {
  e.preventDefault();
  const msg = msgInput.value.trim();
  if (!msg) return;
  
  const replyMatch = msg.match(/^Replying to "(.+?)": (.+)$/);
  if (replyMatch) {
    socket.emit('chatMessage', {
      text: replyMatch[2],
      replyTo: { text: replyMatch[1] },
      roomCode
    });
  } else {
    socket.emit('chatMessage', { text: msg, roomCode });
  }
  
  msgInput.value = '';
  msgInput.focus();
}

function displayMessage(message) {
  const existingMessage = document.querySelector(`.message[data-message-id="${message.id}"]`);
  if (existingMessage) {
    updateMessage(message);
    return;
  }

  const div = document.createElement('div');
  div.classList.add('message');
  div.dataset.messageId = message.id;
  
  if (message.username === username) div.classList.add('user');
  else if (message.username === 'ChatBot') div.classList.add('system');
  else div.classList.add('other');
  
  if (message.replyTo) {
    const replyDiv = document.createElement('div');
    replyDiv.classList.add('reply-preview');
    replyDiv.innerText = `Replying to: ${message.replyTo.text}`;
    div.appendChild(replyDiv);
  }
  
  if (message.username !== 'ChatBot') {
    const meta = document.createElement('div');
    meta.classList.add('meta');
    meta.innerHTML = `<span>${message.username}</span>`;
    div.appendChild(meta);
  }
  
  const contentDiv = document.createElement('div');
  contentDiv.classList.add('content');
  
  if (message.file) {
    if (message.file.data.startsWith('data:image')) {
      const img = document.createElement('img');
      img.src = message.file.data;
      img.style.maxWidth = '200px';
      contentDiv.appendChild(img);
    } else if (message.file.data.startsWith('data:video')) {
      const video = document.createElement('video');
      video.src = message.file.data;
      video.controls = true;
      video.style.maxWidth = '300px';
      contentDiv.appendChild(video);
    }
    const fileInfo = document.createElement('p');
    fileInfo.classList.add('text');
    fileInfo.innerText = message.text || message.file.filename;
    contentDiv.appendChild(fileInfo);
    
    const downloadBtn = document.createElement('button');
    downloadBtn.classList.add('download-btn');
    downloadBtn.innerText = 'Download';
    downloadBtn.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = message.file.data;
      link.download = message.file.filename;
      link.click();
    });
    contentDiv.appendChild(downloadBtn);
  } else {
    const para = document.createElement('p');
    para.classList.add('text');
    para.innerText = message.text;
    contentDiv.appendChild(para);
  }
  div.appendChild(contentDiv);

  if (message.username !== 'ChatBot') {
    const reactionsDiv = document.createElement('div');
    reactionsDiv.classList.add('reactions');
    if (message.reactions) {
      reactionsDiv.innerHTML = Object.entries(message.reactions)
        .map(([emoji, count]) => `<span class="reaction">${emoji} ${count}</span>`)
        .join(' ');
    }
    div.appendChild(reactionsDiv);

    const reactionButtons = document.createElement('div');
    reactionButtons.classList.add('reaction-buttons');
    ['👍', '❤️', '😂'].forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.classList.add('reaction-btn');
      btn.addEventListener('click', () => {
        socket.emit('addReaction', { messageId: message.id, emoji, roomCode });
        btn.classList.add('reacted');
        setTimeout(() => btn.classList.remove('reacted'), 300);
      });
      reactionButtons.appendChild(btn);
    });
    div.appendChild(reactionButtons);
  }
  
  chatMessages.appendChild(div);
  
  div.addEventListener('click', (e) => {
    if (!e.target.closest('.reaction-buttons') && !e.target.closest('.download-btn')) {
      msgInput.value = `Replying to "${message.text || message.file.filename}": `;
      msgInput.focus();
    }
  });
}

function updateMessage(message) {
  const messageElement = document.querySelector(`.message[data-message-id="${message.id}"]`);
  if (messageElement && message.username !== 'ChatBot') {
    const reactionsDiv = messageElement.querySelector('.reactions');
    if (message.reactions) {
      reactionsDiv.innerHTML = Object.entries(message.reactions)
        .map(([emoji, count]) => `<span class="reaction">${emoji} ${count}</span>`)
        .join(' ');
    }
  }
}

function displayUsers(users) {
  usersList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerText = user.username;
    usersList.appendChild(li);
  });
}

function displaySystemMessage(text) {
  const div = document.createElement('div');
  div.classList.add('message', 'system');
  div.innerText = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function cleanupAfterDisconnect() {
  joinBtn.textContent = 'Join Room';
  usernameInput.disabled = false;
  roomCodeInput.disabled = false;
  msgInput.disabled = true;
  isJoined = false;
  isAdmin = false;
  roomCodeDisplay.style.display = 'none';
  usersList.innerHTML = '';
  chatForm.removeEventListener('submit', sendMessage);
}

msgInput.disabled = true;

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    chatSidebar.classList.remove('active');
  }
});
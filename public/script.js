// Connect to the server
const socket = io();

// UI Elements
const preChatForm = document.getElementById('pre-chat-form');
const chatApp = document.getElementById('chat-app');
const roomNameDisplay = document.getElementById('room-name');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

// Room Choice Buttons and Forms
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const createRoomForm = document.getElementById('create-room-form');
const joinRoomForm = document.getElementById('join-room-form');

// Show Create Room Form
createRoomBtn.addEventListener('click', () => {
  createRoomForm.classList.remove('hidden');
  joinRoomForm.classList.add('hidden');
});

// Show Join Room Form
joinRoomBtn.addEventListener('click', () => {
  joinRoomForm.classList.remove('hidden');
  createRoomForm.classList.add('hidden');
});

// Handle Create Room Form Submission
createRoomForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const username = document.getElementById('create-username').value.trim();
  const roomId = document.getElementById('create-room-id').value.trim();
  const password = document.getElementById('create-room-password').value.trim();
  const maxUsers = document.getElementById('create-max-users').value;

  if (username && roomId && password && maxUsers) {
    // Emit to server to create a new room
    socket.emit('create-room', { username, roomId, password, maxUsers });

    // Show chat UI and hide pre-chat form
    preChatForm.classList.add('hidden');
    chatApp.classList.remove('hidden');
    roomNameDisplay.textContent = roomId;
  }
});

// Handle Join Room Form Submission
joinRoomForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const username = document.getElementById('join-username').value.trim();
  const roomId = document.getElementById('join-room-id').value.trim();
  const password = document.getElementById('join-room-password').value.trim();

  if (username && roomId && password) {
    // Emit to server to join the room
    socket.emit('join-room', { username, roomId, password });

    // Show chat UI and hide pre-chat form
    preChatForm.classList.add('hidden');
    chatApp.classList.remove('hidden');
    roomNameDisplay.textContent = roomId;
  }
});

// Send a chat message
sendChatBtn.addEventListener('click', () => {
  const message = chatInput.value.trim();
  if (message) {
    socket.emit('send-message', message);
    chatInput.value = ''; // Clear input after sending
  }
});

// Display received messages
socket.on('receive-message', (data) => {
  const newMessage = document.createElement('p');
  newMessage.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
  chatBox.appendChild(newMessage);
  chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the bottom
});

// Handle errors (e.g., wrong password or room full)
socket.on('room-error', (errorMessage) => {
  alert(errorMessage);
  location.reload(); // Reload page to restart form
});

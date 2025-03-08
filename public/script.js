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
const availableRoomsDiv = document.getElementById('available-rooms');
const roomsTableBody = document.getElementById('rooms-table-body');
const fetchRoomsBtn = document.getElementById('fetch-rooms-btn');

// Show Create Room Form
createRoomBtn.addEventListener('click', () => {
    createRoomForm.classList.remove('hidden');
    joinRoomForm.classList.add('hidden');
    availableRoomsDiv.classList.add('hidden');
});

// Show Join Room Form
joinRoomBtn.addEventListener('click', () => {
    joinRoomForm.classList.remove('hidden');
    createRoomForm.classList.add('hidden');
    availableRoomsDiv.classList.add('hidden');
});

// Fetch available rooms
fetchRoomsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const username = document.getElementById('join-username').value.trim();
    if (username) {
        socket.emit('fetch-available-rooms');
        availableRoomsDiv.classList.remove('hidden');
    } else {
        alert('Please enter your username before fetching available rooms.');
    }
});

// Display available rooms in the table
socket.on('available-rooms', (rooms) => {
    roomsTableBody.innerHTML = '';
    rooms.forEach(room => {
        const row = document.createElement('tr');
        row.innerHTML = 
            `<td>${room.roomId}</td>
            <td>${room.maxUsers}</td>
            <td><button class="join-room-btn" data-room-id="${room.roomId}" data-max-users="${room.maxUsers}">Join</button></td>`;
        roomsTableBody.appendChild(row);
    });

    document.querySelectorAll('.join-room-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const roomId = btn.getAttribute('data-room-id');
            const username = document.getElementById('join-username').value.trim();
            const password = prompt(`Enter password for room ${roomId}:`);
            if (password) {
                socket.emit('set-username', username);
                socket.emit('join-room', { username, roomId, password });
            }
        });
    });
});

// Handle Create Room Form Submission
createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('create-username').value.trim();
    const roomId = document.getElementById('create-room-id').value.trim();
    const password = document.getElementById('create-room-password').value.trim();
    const maxUsers = parseInt(document.getElementById('create-max-users').value, 10);

    if (username && roomId && password && maxUsers) {
        socket.emit('set-username', username);
        socket.emit('create-room', { username, roomId, password, maxUsers });
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
        chatInput.value = ''; 
    }
});

// Display received messages
socket.on('receive-message', (data) => {
    const newMessage = document.createElement('div');
    const isMyMessage = data.username === document.getElementById('create-username').value.trim() || 
                        data.username === document.getElementById('join-username').value.trim();

    newMessage.className = isMyMessage ? 'message my-message' : 'message other-message';
    newMessage.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
    chatBox.appendChild(newMessage);
    chatBox.scrollTop = chatBox.scrollHeight; 
});

// Function to display messages
function displayMessage(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'you' ? 'sent' : 'received');

    const messageContent = document.createElement('p');
    messageContent.textContent = message;

    messageDiv.appendChild(messageContent);
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto scroll
}

// Handle successful room join
socket.on('join-success', (roomId) => {
    preChatForm.classList.add('hidden');
    chatApp.classList.remove('hidden');
    roomNameDisplay.textContent = roomId;
});

// Handle errors
socket.on('room-error', (errorMessage) => {
    alert(errorMessage);
    location.reload();
});

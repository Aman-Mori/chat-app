const socket = io();

// UI Elements
const preChatForm = document.getElementById('pre-chat-form');
const chatApp = document.getElementById('chat-app');
const roomNameDisplay = document.getElementById('room-name');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

// File Element
const fileInput = document.getElementById('file-input');

// Room Elements
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const createRoomForm = document.getElementById('create-room-form');
const joinRoomForm = document.getElementById('join-room-form');
const availableRoomsDiv = document.getElementById('available-rooms');
const roomsTableBody = document.getElementById('rooms-table-body');
const fetchRoomsBtn = document.getElementById('fetch-rooms-btn');

// =================================
// ROOM UI HANDLERS
// =================================

createRoomBtn.addEventListener('click', () => {
    createRoomForm.classList.remove('hidden');
    joinRoomForm.classList.add('hidden');
    availableRoomsDiv.classList.add('hidden');
});

joinRoomBtn.addEventListener('click', () => {
    joinRoomForm.classList.remove('hidden');
    createRoomForm.classList.add('hidden');
    availableRoomsDiv.classList.add('hidden');
});

// =================================
// FETCH ROOMS
// =================================

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

// =================================
// DISPLAY ROOMS
// =================================

socket.on('available-rooms', (rooms) => {
    roomsTableBody.innerHTML = '';

    rooms.forEach(room => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${room.roomId}</td>
            <td>${room.maxUsers}</td>
            <td>
                <button class="join-room-btn" data-room-id="${room.roomId}">
                    Join
                </button>
            </td>
        `;

        roomsTableBody.appendChild(row);
    });

    document.querySelectorAll('.join-room-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const roomId = btn.getAttribute('data-room-id');
            const username = document.getElementById('join-username').value.trim();
            const password = prompt(`Enter password for room ${roomId}:`);

            if (password) {
                socket.emit('join-room', {
                    username,
                    roomId,
                    password
                });
            }
        });
    });
});

// =================================
// CREATE ROOM
// =================================

createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('create-username').value.trim();
    const roomId = document.getElementById('create-room-id').value.trim();
    const password = document.getElementById('create-room-password').value.trim();
    const maxUsers = parseInt(document.getElementById('create-max-users').value, 10);

    if (username && roomId && password && maxUsers) {
        socket.emit('create-room', {
            username,
            roomId,
            password,
            maxUsers
        });

        preChatForm.classList.add('hidden');
        chatApp.classList.remove('hidden');
        roomNameDisplay.textContent = roomId;
    }
});

// =================================
// SEND MESSAGE
// =================================

sendChatBtn.addEventListener('click', sendMessage);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const message = chatInput.value.trim();

    if (message) {
        socket.emit('send-message', message);
        chatInput.value = '';
    }
}

// =================================
// LONG PRESS → FILE PICKER
// =================================

let pressTimer = null;

sendChatBtn.addEventListener('pointerdown', startPress);
sendChatBtn.addEventListener('pointerup', cancelPress);
sendChatBtn.addEventListener('pointercancel', cancelPress);

function startPress() {
    pressTimer = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        fileInput.click();
    }, 600);
}

function cancelPress() {
    clearTimeout(pressTimer);
}

// =================================
// AUTO FILE UPLOAD
// =================================

fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            socket.emit('send-file', {
                fileName: data.fileName,
                fileUrl: data.fileUrl
            });

            fileInput.value = '';
        } else {
            alert(data.message);
        }

    } catch (error) {
        console.error(error);
        alert('File upload failed');
    }
});

// =================================
// RECEIVE MESSAGE (UPDATED FORMAT)
// =================================

socket.on('receive-message', (data) => {

    const newMessage = document.createElement('div');

    const myUsername =
        document.getElementById('create-username').value.trim() ||
        document.getElementById('join-username').value.trim();

    const isMyMessage = data.username === myUsername;

    newMessage.className =
        isMyMessage ? 'message my-message' : 'message other-message';

    // ✅ EXACT FORMAT YOU WANT
    newMessage.textContent = `${data.username}: ${data.message}`;

    chatBox.appendChild(newMessage);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// =================================
// RECEIVE FILE (UPDATED FORMAT OPTIONAL)
// =================================

socket.on('receive-file', (data) => {

    const fileMessage = document.createElement('div');

    const myUsername =
        document.getElementById('create-username').value.trim() ||
        document.getElementById('join-username').value.trim();

    const isMyMessage = data.username === myUsername;

    fileMessage.className =
        isMyMessage ? 'message my-message' : 'message other-message';

    fileMessage.innerHTML = `
        ${data.username}: 📎 ${data.fileName}
        <br>
        <a href="${data.fileUrl}" target="_blank" download>
            ⬇ Download
        </a>
    `;

    chatBox.appendChild(fileMessage);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// =================================
// JOIN SUCCESS
// =================================

socket.on('join-success', (roomId) => {
    preChatForm.classList.add('hidden');
    chatApp.classList.remove('hidden');
    roomNameDisplay.textContent = roomId;
});

// =================================
// ERROR HANDLING
// =================================

socket.on('room-error', (errorMessage) => {
    alert(errorMessage);
    location.reload();
});
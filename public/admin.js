// admin.js

const socket = io();

// Admin password (should be stored securely in a real application)
const adminPassword = 'yourAdminPassword'; // Change this

// Admin login handler
document.getElementById('admin-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inputPassword = document.getElementById('admin-password').value;

    if (inputPassword === adminPassword) {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('delete-room-section').style.display = 'block';
    } else {
        document.getElementById('admin-message').textContent = 'Incorrect password. Please try again.';
    }
});

// Handle Delete Room Form Submission
document.getElementById('delete-room-form').addEventListener('submit', (event) => {
    event.preventDefault();

    const roomId = document.getElementById('delete-room-id').value.trim();
    const roomPassword = document.getElementById('delete-room-password').value.trim();

    if (roomId && roomPassword) {
        // Emit the delete-room event with roomId and roomPassword
        socket.emit('delete-room', { roomId, password: roomPassword });
    } else {
        alert("Please enter a room ID and password.");
    }
});

// Listen for successful room deletion
socket.on('room-deleted', (message) => {
    const messageDiv = document.getElementById('response-message');
    messageDiv.textContent = message;
    messageDiv.className = 'response-message success'; // Add success class
    document.getElementById('delete-room-id').value = ''; // Clear input
    document.getElementById('delete-room-password').value = ''; // Clear password
});

// Handle errors
socket.on('room-error', (errorMessage) => {
    const messageDiv = document.getElementById('response-message');
    messageDiv.textContent = errorMessage;
    messageDiv.className = 'response-message'; // Use default error class
    alert(errorMessage); // Optionally alert the error
});

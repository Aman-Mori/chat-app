const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Set up express server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (index.html, CSS, JS)
app.use(express.static('public'));

// Room storage
const rooms = {};

// Handle socket connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle room creation
  socket.on('create-room', ({ username, roomId, password, maxUsers }) => {
    if (rooms[roomId]) {
      socket.emit('room-error', 'Room already exists. Choose a different ID.');
      return;
    }

    // Create a new room
    rooms[roomId] = {
      users: [],
      password: password,
      maxUsers: parseInt(maxUsers),
    };

    socket.join(roomId);
    rooms[roomId].users.push({ username, id: socket.id });

    console.log(`Room ${roomId} created by ${username}`);

    // Notify others in the room
    io.to(roomId).emit('receive-message', {
      username: 'System',
      message: `${username} has created the room.`,
    });

    // Handle sending messages
    socket.on('send-message', (message) => {
      io.to(roomId).emit('receive-message', { username, message });
    });
  });

  // Handle room joining
  socket.on('join-room', ({ username, roomId, password }) => {
    const room = rooms[roomId];

    // Check if the room exists
    if (!room) {
      socket.emit('room-error', 'Room not found.');
      return;
    }

    // Check if password is correct
    if (room.password !== password) {
      socket.emit('room-error', 'Incorrect room password.');
      return;
    }

    // Check if the room is full
    if (room.users.length >= room.maxUsers) {
      socket.emit('room-error', 'Room is full.');
      return;
    }

    socket.join(roomId);
    room.users.push({ username, id: socket.id });
    console.log(`User ${username} joined room ${roomId}`);

    // Notify others in the room
    io.to(roomId).emit('receive-message', {
      username: 'System',
      message: `${username} has joined the room.`,
    });

    // Handle sending messages
    socket.on('send-message', (message) => {
      io.to(roomId).emit('receive-message', { username, message });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      room.users = room.users.filter((user) => user.id !== socket.id);
      io.to(roomId).emit('receive-message', {
        username: 'System',
        message: `${username} has left the room.`,
      });
      console.log(`User ${username} left room ${roomId}`);
    });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

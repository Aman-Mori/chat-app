const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { addRoom, getRoom, deleteRoom, getAllRooms } = require('./database');

// Set up express server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (index.html, CSS, JS)
app.use(express.static('public'));
app.use(express.json()); // For parsing application/json

// Room storage
const rooms = {};

// Handle socket connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    let currentRoom = null;
    let username = '';

    // Handle room creation
    socket.on('create-room', async ({ username: newUsername, roomId, password, maxUsers }) => {
        console.log(`Creating room: ${roomId}, Password: ${password}, Max Users: ${maxUsers}`);

        if (rooms[roomId]) {
            socket.emit('room-error', 'Room already exists in memory.');
            return;
        }

        const dbRoom = await getRoom(roomId);
        if (dbRoom) {
            socket.emit('room-error', 'Room already exists in the database.');
            return;
        }

        try {
            await addRoom(roomId, password, maxUsers);
            rooms[roomId] = { users: [], maxUsers: parseInt(maxUsers, 10) };
            socket.join(roomId);
            username = newUsername; // Set username for this session
            currentRoom = roomId;
            rooms[roomId].users.push({ username, id: socket.id });
            socket.emit('join-success', roomId);
            io.to(roomId).emit('receive-message', {
                username: 'System',
                message: `${username} has created the room.`,
            });
        } catch (error) {
            console.error('Error creating room:', error);
            socket.emit('room-error', 'Error creating room. Try again later.');
        }
    });

    // Fetch available rooms
    socket.on('fetch-available-rooms', async () => {
        try {
            const allRooms = await getAllRooms();
            socket.emit('available-rooms', allRooms);
        } catch (error) {
            console.error(error);
        }
    });

    // Handle room joining
    socket.on('join-room', async ({ username: newUsername, roomId, password }) => {
        console.log(`User ${newUsername} trying to join room: ${roomId}`);

        const room = rooms[roomId]; // Check in-memory room
        const dbRoom = await getRoom(roomId); // Check database room

        if (!dbRoom) {
            socket.emit('room-error', 'Room not found in the database.');
            return;
        }

        if (dbRoom.password !== password) {
            socket.emit('room-error', 'Incorrect room password.');
            return;
        }

        if (room && room.users.length < room.maxUsers) {
            socket.join(roomId);
            username = newUsername; // Set username for this session
            currentRoom = roomId;
            room.users.push({ username, id: socket.id });
            socket.emit('join-success', roomId);
            io.to(roomId).emit('receive-message', {
                username: 'System',
                message: `${username} has joined the room.`,
            });
        } else {
            socket.emit('room-error', 'Room is full or does not exist.');
        }
    });

    // Send a chat message
    socket.on('send-message', (message) => {
        if (currentRoom) {
            io.to(currentRoom).emit('receive-message', {
                username: username,
                message: message,
            });
        }
    });

    // Handle room deletion
    socket.on('delete-room', async ({ roomId, password }) => {
        const dbRoom = await getRoom(roomId);
        if (!dbRoom) {
            socket.emit('room-error', 'Room not found.');
            return;
        }

        if (dbRoom.password !== password) {
            socket.emit('room-error', 'Incorrect room password.');
            return;
        }

        // Delete room from database and memory
        try {
            await deleteRoom(roomId);
            delete rooms[roomId];
            socket.emit('room-deleted', `Room ${roomId} has been deleted successfully.`);
        } catch (error) {
            console.error('Error deleting room:', error);
            socket.emit('room-error', 'Error deleting room. Try again later.');
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (currentRoom && username) {
            const room = rooms[currentRoom];
            if (room) {
                room.users = room.users.filter(user => user.id !== socket.id); // Remove user from room
                io.to(currentRoom).emit('receive-message', {
                    username: 'System',
                    message: `${username} has left the room.`,
                });

                // Optionally notify if the room is empty or manage user count
                if (room.users.length === 0) {
                    delete rooms[currentRoom]; // Remove the room if empty
                }
            }
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

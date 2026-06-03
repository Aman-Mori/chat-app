const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { addRoom, getRoom, deleteRoom, getAllRooms } = require('./database');

// Set up express server
const app = express();

// Trust Render proxy
app.set('trust proxy', true);

// Visitor tracking logs
app.use((req, res, next) => {

    // Get real IP
    const forwarded = req.headers['x-forwarded-for'];

    const ip = forwarded
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress;

    // Browser info
    const userAgent = req.headers['user-agent'] || '';

    // Detect browser
    let browser = 'Unknown Browser';

    if (userAgent.includes('Brave')) {
        browser = 'Brave';
    } else if (userAgent.includes('Chrome')) {
        browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
        browser = 'Firefox';
    } else if (userAgent.includes('Safari')) {
        browser = 'Safari';
    } else if (userAgent.includes('Edge')) {
        browser = 'Edge';
    }

    // Detect phone name/model
    let phone = 'Unknown Device';

    // Samsung
    const samsungMatch = userAgent.match(/SM-[A-Z0-9]+/);
    if (samsungMatch) {
        phone = samsungMatch[0];
    }

    // Redmi / Xiaomi
    const redmiMatch = userAgent.match(/Redmi[\w\s\d-]+/);
    if (redmiMatch) {
        phone = redmiMatch[0];
    }

    // iPhone
    if (userAgent.includes('iPhone')) {
        phone = 'iPhone';
    }

    // Realme
    const realmeMatch = userAgent.match(/RMX\d+/);
    if (realmeMatch) {
        phone = realmeMatch[0];
    }

    // Vivo
    const vivoMatch = userAgent.match(/V\d{4}/);
    if (vivoMatch) {
        phone = vivoMatch[0];
    }

    // Oppo
    const oppoMatch = userAgent.match(/CPH\d+/);
    if (oppoMatch) {
        phone = oppoMatch[0];
    }

    console.log('==============================');
    console.log('IP:', ip);
    console.log('Browser:', browser);
    console.log('Phone:', phone);
    console.log('User-Agent:', userAgent);
    console.log('Time:', new Date().toISOString());
    console.log('==============================');

    next();
});

const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Room storage
const rooms = {};

// Handle socket connection
io.on('connection', (socket) => {

    console.log('A user connected:', socket.id);

    let currentRoom = null;
    let username = '';

    // Create room
    socket.on('create-room', async ({
        username: newUsername,
        roomId,
        password,
        maxUsers
    }) => {

        console.log(`Creating room: ${roomId}`);

        if (rooms[roomId]) {
            socket.emit('room-error', 'Room already exists.');
            return;
        }

        const dbRoom = await getRoom(roomId);

        if (dbRoom) {
            socket.emit('room-error', 'Room already exists.');
            return;
        }

        try {

            await addRoom(roomId, password, maxUsers);

            rooms[roomId] = {
                users: [],
                maxUsers: parseInt(maxUsers, 10)
            };

            socket.join(roomId);

            username = newUsername;
            currentRoom = roomId;

            rooms[roomId].users.push({
                username,
                id: socket.id
            });

            socket.emit('join-success', roomId);

            io.to(roomId).emit('receive-message', {
                username: 'System',
                message: `${username} has created the room.`,
            });

        } catch (error) {

            console.error('Error creating room:', error);

            socket.emit(
                'room-error',
                'Error creating room. Try again later.'
            );
        }
    });

    // Fetch rooms
    socket.on('fetch-available-rooms', async () => {

        try {

            const allRooms = await getAllRooms();

            socket.emit('available-rooms', allRooms);

        } catch (error) {

            console.error(error);
        }
    });

    // Join room
    socket.on('join-room', async ({
        username: newUsername,
        roomId,
        password
    }) => {

        console.log(`User ${newUsername} trying to join room: ${roomId}`);

        const room = rooms[roomId];
        const dbRoom = await getRoom(roomId);

        if (!dbRoom) {
            socket.emit('room-error', 'Room not found.');
            return;
        }

        if (dbRoom.password !== password) {
            socket.emit('room-error', 'Incorrect password.');
            return;
        }

        if (room && room.users.length < room.maxUsers) {

            socket.join(roomId);

            username = newUsername;
            currentRoom = roomId;

            room.users.push({
                username,
                id: socket.id
            });

            socket.emit('join-success', roomId);

            io.to(roomId).emit('receive-message', {
                username: 'System',
                message: `${username} has joined the room.`,
            });

        } else {

            socket.emit(
                'room-error',
                'Room is full or does not exist.'
            );
        }
    });

    // Send message
    socket.on('send-message', (message) => {

        if (currentRoom) {

            io.to(currentRoom).emit('receive-message', {
                username: username,
                message: message,
            });
        }
    });

    // Delete room
    socket.on('delete-room', async ({ roomId, password }) => {

        const dbRoom = await getRoom(roomId);

        if (!dbRoom) {
            socket.emit('room-error', 'Room not found.');
            return;
        }

        if (dbRoom.password !== password) {
            socket.emit('room-error', 'Incorrect password.');
            return;
        }

        try {

            await deleteRoom(roomId);

            delete rooms[roomId];

            socket.emit(
                'room-deleted',
                `Room ${roomId} deleted successfully.`
            );

        } catch (error) {

            console.error('Error deleting room:', error);

            socket.emit(
                'room-error',
                'Error deleting room.'
            );
        }
    });

    // Disconnect
    socket.on('disconnect', () => {

        console.log('User disconnected:', socket.id);

        if (currentRoom && username) {

            const room = rooms[currentRoom];

            if (room) {

                room.users = room.users.filter(
                    user => user.id !== socket.id
                );

                io.to(currentRoom).emit('receive-message', {
                    username: 'System',
                    message: `${username} has left the room.`,
                });

                if (room.users.length === 0) {
                    delete rooms[currentRoom];
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

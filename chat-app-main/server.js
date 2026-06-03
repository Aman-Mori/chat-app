const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const {
    addRoom,
    getRoom,
    deleteRoom,
    getAllRooms
} = require('./database');

// Set up express server
const app = express();

// Trust Render proxy
app.set('trust proxy', true);

// ===============================
// CREATE UPLOADS FOLDER
// ===============================

const uploadsPath = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath);
}

// ===============================
// MULTER STORAGE
// ===============================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },

    filename: (req, file, cb) => {

        const uniqueName =
            Date.now() + '-' + file.originalname;

        cb(null, uniqueName);
    }
});

// ===============================
// FILE FILTER
// ===============================

const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const fileFilter = (req, file, cb) => {

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

// ===============================
// MULTER CONFIG
// ===============================

const upload = multer({

    storage,

    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },

    fileFilter
});

// Visitor tracking logs
app.use((req, res, next) => {

    const forwarded = req.headers['x-forwarded-for'];

    const ip = forwarded
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress;

    const userAgent = req.headers['user-agent'] || '';

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

    let phone = 'Unknown Device';

    const samsungMatch = userAgent.match(/SM-[A-Z0-9]+/);
    if (samsungMatch) {
        phone = samsungMatch[0];
    }

    const redmiMatch = userAgent.match(/Redmi[\w\s\d-]+/);
    if (redmiMatch) {
        phone = redmiMatch[0];
    }

    if (userAgent.includes('iPhone')) {
        phone = 'iPhone';
    }

    const realmeMatch = userAgent.match(/RMX\d+/);
    if (realmeMatch) {
        phone = realmeMatch[0];
    }

    const vivoMatch = userAgent.match(/V\d{4}/);
    if (vivoMatch) {
        phone = vivoMatch[0];
    }

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

// Serve uploads folder
app.use('/uploads', express.static('uploads'));

// Room storage
const rooms = {};

// ===============================
// FILE UPLOAD ROUTE
// ===============================

app.post('/upload', upload.single('file'), (req, res) => {

    try {

        if (!req.file) {

            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        res.json({
            success: true,
            fileName: req.file.originalname,
            fileUrl: `/uploads/${req.file.filename}`
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Upload failed'
        });
    }
});

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

    // ===============================
    // SEND TEXT MESSAGE
    // ===============================

    socket.on('send-message', (message) => {

        if (currentRoom) {

            io.to(currentRoom).emit('receive-message', {
                username: username,
                message: message,
            });
        }
    });

    // ===============================
    // SEND FILE MESSAGE
    // ===============================

    socket.on('send-file', (fileData) => {

        if (currentRoom) {

            io.to(currentRoom).emit('receive-file', {

                username: username,

                fileName: fileData.fileName,

                fileUrl: fileData.fileUrl
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
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
// SOCKET.IO VISITOR LOGGING
// ===============================

function formatDateTime(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours === 0 ? 12 : hours;

    const formattedHours = String(hours).padStart(2, '0');

    return `${day}-${month}-${year} ${formattedHours}:${minutes} ${ampm}`;
}

function getVisitorIp(socket) {
    const forwarded = socket.handshake.headers['x-forwarded-for'];

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    return socket.handshake.address || '';
}

function getBrowserName(userAgent = '') {
    if (userAgent.includes('Brave')) {
        return 'Brave';
    } else if (userAgent.includes('Edg')) {
        return 'Edge';
    } else if (userAgent.includes('Chrome')) {
        return 'Chrome';
    } else if (userAgent.includes('Firefox')) {
        return 'Firefox';
    } else if (userAgent.includes('Safari')) {
        return 'Safari';
    }

    return 'Unknown Browser';
}

function getDeviceName(userAgent = '') {
    const samsungMatch = userAgent.match(/SM-[A-Z0-9]+/);
    if (samsungMatch) {
        return samsungMatch[0];
    }

    const redmiMatch = userAgent.match(/Redmi[\w\s\d-]+/);
    if (redmiMatch) {
        return redmiMatch[0].trim();
    }

    if (userAgent.includes('iPhone')) {
        return 'iPhone';
    }

    const realmeMatch = userAgent.match(/RMX\d+/);
    if (realmeMatch) {
        return realmeMatch[0];
    }

    const vivoMatch = userAgent.match(/V\d{4}/);
    if (vivoMatch) {
        return vivoMatch[0];
    }

    const oppoMatch = userAgent.match(/CPH\d+/);
    if (oppoMatch) {
        return oppoMatch[0];
    }

    return 'Unknown Device';
}

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

    const userAgent = socket.handshake.headers['user-agent'] || '';
    const visitorIp = getVisitorIp(socket);
    const browser = getBrowserName(userAgent);
    const device = getDeviceName(userAgent);
    const joinedAt = formatDateTime(new Date());

    console.log('========== VISITOR ==========');
    console.log(`IP       : ${visitorIp}`);
    console.log(`Device   : ${device}`);
    console.log(`Browser  : ${browser}`);
    console.log(`Joined   : ${joinedAt}`);
    console.log('=============================');

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

        console.log('----------- LEFT ------------');
        console.log(`IP       : ${visitorIp}`);
        console.log(`Exit     : ${formatDateTime(new Date())}`);
        console.log('-----------------------------');

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

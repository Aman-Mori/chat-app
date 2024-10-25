const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./rooms.db');

// Initialize the database and create the rooms table if it doesn't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
        roomId TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        maxUsers INTEGER NOT NULL
    )`);
});

// Function to add a room to the database
const addRoom = (roomId, password, maxUsers) => {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO rooms (roomId, password, maxUsers) VALUES (?, ?, ?)`, [roomId, password, maxUsers], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
};

// Function to get a room from the database
const getRoom = (roomId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM rooms WHERE roomId = ?', [roomId], (err, row) => {
            if (err) {
                console.error('Database query error:', err);
                return reject(err);
            }
            resolve(row); // Return the row found (or undefined if not found)
        });
    });
};

// Function to delete a room from the database
const deleteRoom = (roomId) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM rooms WHERE roomId = ?`, [roomId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes); // This returns the number of rows deleted
            }
        });
    });
};

// Function to get all rooms from the database
const getAllRooms = () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT roomId, password, maxUsers FROM rooms`, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Export the functions
module.exports = {
    addRoom,
    getRoom,
    deleteRoom,
    getAllRooms,
};

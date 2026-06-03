const sqlite3 = require('sqlite3').verbose();

// ======================================
// DATABASE CONNECTION
// ======================================

const db = new sqlite3.Database('./rooms.db', (err) => {

    if (err) {

        console.error('Database connection error:', err);

    } else {

        console.log('Connected to SQLite database');
    }
});

// ======================================
// BETTER SQLITE PERFORMANCE
// ======================================

db.serialize(() => {

    db.run(`PRAGMA journal_mode = WAL`);

    // ======================================
    // CREATE TABLE
    // ======================================

    db.run(`
        CREATE TABLE IF NOT EXISTS rooms (

            roomId TEXT PRIMARY KEY,

            password TEXT NOT NULL,

            maxUsers INTEGER NOT NULL,

            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// ======================================
// ADD ROOM
// ======================================

const addRoom = (roomId, password, maxUsers) => {

    return new Promise((resolve, reject) => {

        const query = `
            INSERT INTO rooms
            (roomId, password, maxUsers)
            VALUES (?, ?, ?)
        `;

        db.run(
            query,
            [roomId, password, maxUsers],

            function (err) {

                if (err) {

                    console.error(
                        'Add room error:',
                        err
                    );

                    reject(err);

                } else {

                    resolve({
                        success: true,
                        id: this.lastID
                    });
                }
            }
        );
    });
};

// ======================================
// GET SINGLE ROOM
// ======================================

const getRoom = (roomId) => {

    return new Promise((resolve, reject) => {

        const query = `
            SELECT *
            FROM rooms
            WHERE roomId = ?
        `;

        db.get(query, [roomId], (err, row) => {

            if (err) {

                console.error(
                    'Get room error:',
                    err
                );

                reject(err);

            } else {

                resolve(row || null);
            }
        });
    });
};

// ======================================
// DELETE ROOM
// ======================================

const deleteRoom = (roomId) => {

    return new Promise((resolve, reject) => {

        const query = `
            DELETE FROM rooms
            WHERE roomId = ?
        `;

        db.run(query, [roomId], function (err) {

            if (err) {

                console.error(
                    'Delete room error:',
                    err
                );

                reject(err);

            } else {

                resolve({
                    success: true,
                    deletedRows: this.changes
                });
            }
        });
    });
};

// ======================================
// GET ALL ROOMS
// ======================================

const getAllRooms = () => {

    return new Promise((resolve, reject) => {

        const query = `
            SELECT
                roomId,
                maxUsers,
                createdAt
            FROM rooms

            ORDER BY createdAt DESC
        `;

        db.all(query, [], (err, rows) => {

            if (err) {

                console.error(
                    'Get all rooms error:',
                    err
                );

                reject(err);

            } else {

                resolve(rows || []);
            }
        });
    });
};

// ======================================
// EXPORTS
// ======================================

module.exports = {

    addRoom,

    getRoom,

    deleteRoom,

    getAllRooms
};
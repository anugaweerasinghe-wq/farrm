const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const email = 'abheek.pathirana@gmail.com';
const password = 'password123'; // Temporary password

async function createAdmin() {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();
    const profileId = randomUUID();
    const referralId = 'REF-' + require('crypto').randomBytes(4).toString('hex').toUpperCase();

    db.serialize(() => {
        // First delete if exists
        db.run("DELETE FROM users WHERE email = ?", [email], (err) => {
            if (err) console.error("Error deleting user:", err);
            else console.log("Cleaned up existing user");
        });

        // Insert new user
        db.run(
            'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
            [userId, email, hashedPassword],
            function (err) {
                if (err) {
                    console.error("Error creating user:", err);
                    return;
                }
                console.log("Created user record");

                // Create profile
                db.run(
                    'INSERT INTO profiles (id, user_id, full_name, referral_id) VALUES (?, ?, ?, ?)',
                    [profileId, userId, 'Admin User', referralId],
                    (err) => {
                        if (err) console.error('Error creating profile:', err);
                        else console.log("Created profile record");
                    }
                );
            }
        );
    });
}

createAdmin();

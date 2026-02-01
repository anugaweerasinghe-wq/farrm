const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const emails = ['abheek.pathirana@gmail.com', 'abheek.pathirana@springfield.lk'];

db.serialize(() => {
    emails.forEach(email => {
        db.run("DELETE FROM users WHERE email = ?", [email], function (err) {
            if (err) console.error('Error deleting user:', err);
            else console.log(`Deleted user ${email} (Changes: ${this.changes})`);
        });
    });
});

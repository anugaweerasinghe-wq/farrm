const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("ALTER TABLE profiles ADD COLUMN birthday TEXT", (err) => {
        if (err) console.log("birthday column might already exist or error:", err.message);
        else console.log("Added birthday column");
    });
    db.run("ALTER TABLE profiles ADD COLUMN gender TEXT", (err) => {
        if (err) console.log("gender column might already exist or error:", err.message);
        else console.log("Added gender column");
    });
    db.run("ALTER TABLE profiles ADD COLUMN referral_source TEXT", (err) => {
        if (err) console.log("referral_source column might already exist or error:", err.message);
        else console.log("Added referral_source column");
    });
});

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = randomUUID();

        db.run(
            'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
            [userId, email, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Email already exists' });
                    }
                    return res.status(500).json({ error: err.message });
                }

                // Create empty profile
                const profileId = randomUUID();
                const referralId = 'REF-' + require('crypto').randomBytes(4).toString('hex').toUpperCase();

                db.run(
                    'INSERT INTO profiles (id, user_id, full_name, referral_id) VALUES (?, ?, ?, ?)',
                    [profileId, userId, email.split('@')[0], referralId], // Default name from email
                    (err) => {
                        if (err) console.error('Error creating profile:', err);
                    }
                );

                const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '24h' });
                res.json({
                    user: { id: userId, email },
                    session: { access_token: token, user: { id: userId, email } }
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            user: { id: user.id, email: user.email },
            session: { access_token: token, user: { id: user.id, email: user.email } }
        });
    });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.get('SELECT id, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    });
});

// Profile Routes
app.get('/api/profiles/:userId', authenticateToken, (req, res) => {
    // Allow users to read their own profile
    if (req.params.userId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    db.get('SELECT * FROM profiles WHERE user_id = ?', [req.params.userId], (err, profile) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json(profile);
    });
});

app.put('/api/profiles/:userId', authenticateToken, (req, res) => {
    if (req.params.userId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { full_name, address, gps_location, phone_number, birthday, gender, referral_source } = req.body;

    db.run(
        `UPDATE profiles 
     SET full_name = COALESCE(?, full_name), 
         address = COALESCE(?, address), 
         gps_location = COALESCE(?, gps_location),
         phone_number = COALESCE(?, phone_number),
         birthday = COALESCE(?, birthday),
         gender = COALESCE(?, gender),
         referral_source = COALESCE(?, referral_source)
     WHERE user_id = ?`,
        [full_name, address, gps_location, phone_number, birthday, gender, referral_source, req.params.userId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Profile updated successfully' });
        }
    );
});

// Order Routes
app.post('/api/orders', authenticateToken, (req, res) => {
    const { product_id, quantity, total_price } = req.body;
    const orderId = randomUUID();

    db.run(
        'INSERT INTO orders (id, user_id, product_id, quantity, total_price) VALUES (?, ?, ?, ?, ?)',
        [orderId, req.user.id, product_id, quantity, total_price],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Order created successfully', orderId });
        }
    );
});

app.get('/api/orders', authenticateToken, (req, res) => {
    db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(orders);
    });
});

app.delete('/api/orders/:orderId', authenticateToken, (req, res) => {
    const { orderId } = req.params;

    db.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, req.user.id], (err, order) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const orderDate = new Date(order.created_at);
        const now = new Date();
        const diffMs = now - orderDate;
        const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes

        // Check if less than 1 minute (60000 ms)
        if (diffMs > 60000) {
            return res.status(400).json({ error: 'Order cannot be cancelled after 1 minute' });
        }

        db.run('DELETE FROM orders WHERE id = ?', [orderId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Order cancelled successfully' });
        });
    });
});

// Admin Routes (Simplified - no role check for now, just authenticated)
app.get('/api/admin/profiles', authenticateToken, (req, res) => {
    const query = `
        SELECT profiles.*, users.email, users.created_at as joined_at
        FROM profiles 
        JOIN users ON profiles.user_id = users.id 
        ORDER BY users.created_at DESC
    `;
    db.all(query, (err, profiles) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(profiles);
    });
});

app.get('/api/admin/orders', authenticateToken, (req, res) => {
    db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, orders) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(orders);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

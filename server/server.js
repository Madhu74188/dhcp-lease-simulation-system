/**
 * Express.js & MongoDB Server for DHCP Lease Simulation System
 * MERN Stack Architecture
 */
const dns = require('dns');
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

let MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    try {
        const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
        const match = envContent.match(/MONGODB_URI=(.*)/);
        if (match && match[1]) MONGODB_URI = match[1].trim();
    } catch (e) {}
}
if (!MONGODB_URI) {
    MONGODB_URI = 'mongodb+srv://campusconnect_user:Madhumitha74188@cluster0.afagoyj.mongodb.net/dhcp_simulation?retryWrites=true&w=majority';
}

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
console.log('Connecting to MongoDB database...');
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✓ Successfully connected to MongoDB database');
    })
    .catch((err) => {
        console.warn('! Note: MongoDB local instance offline or connecting. Using resilient memory fallback cache:', err.message);
    });

// API Routes
app.use('/api/dhcp', require('./routes/dhcpRoutes'));

// Serve static frontend in production
app.use(express.static(path.join(__dirname, '../')));

// Root Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'DHCP Simulation Server',
        database: mongoose.connection.readyState === 1 ? 'Connected to MongoDB' : 'Memory Cache Mode',
        timestamp: new Date()
    });
});

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`DHCP MERN Backend Server running on port ${PORT}`);
    console.log(`API Health: http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
});

module.exports = app;

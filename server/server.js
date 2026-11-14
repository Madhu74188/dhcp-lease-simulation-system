/**
 * Express.js & MongoDB Server for DHCP Lease Simulation System
 * MERN Stack Architecture
 */
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dhcp_simulation';

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

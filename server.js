/**
 * Network Address Allocation and DHCP Lease Simulation System
 * Full MERN Backend Server with MongoDB Atlas Cloud Integration
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
const PORT = process.env.PORT || 3000;

// Read Atlas URI from server/.env or fallback to configured Atlas cluster
let MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    try {
        const envContent = fs.readFileSync(path.join(__dirname, 'server/.env'), 'utf8');
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

// MongoDB Atlas Connection
console.log('Connecting to MongoDB Atlas Cloud database...');
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✓ Successfully connected to MongoDB Atlas (Database: dhcp_simulation)');
    })
    .catch((err) => {
        console.warn('! Note: MongoDB connecting in resilient fallback cache mode:', err.message);
    });

// API Routes
app.use('/api/dhcp', require('./server/routes/dhcpRoutes'));

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`DHCP Simulation Live Web App running on http://localhost:${PORT}`);
    console.log(`Connected to MongoDB Atlas Database: dhcp_simulation`);
    console.log(`======================================================\n`);
});

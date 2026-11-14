/**
 * MongoDB Mongoose Model: IpPool
 * Represents an IP address entry in the DHCP Scope Address Pool
 */
const mongoose = require('mongoose');

const ipPoolSchema = new mongoose.Schema({
    ipAddress: {
        type: String,
        required: true,
        unique: true
    },
    octet: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['AVAILABLE', 'OFFERED', 'BOUND', 'CONFLICTED', 'EXPIRED'],
        default: 'AVAILABLE'
    },
    allocatedToMac: {
        type: String,
        default: null
    },
    allocatedToHost: {
        type: String,
        default: null
    },
    conflictReason: {
        type: String,
        default: null
    },
    leasedAt: {
        type: Number,
        default: 0
    },
    expiresAt: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('IpPool', ipPoolSchema);

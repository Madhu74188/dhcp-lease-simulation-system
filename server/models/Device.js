/**
 * MongoDB Mongoose Model: Device
 * Represents a network client device managed by DHCP
 */
const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    hostname: {
        type: String,
        required: true,
        trim: true,
        match: [/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/, 'Invalid RFC 1123 Hostname format']
    },
    macAddress: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        match: [
            /^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}$/,
            'Invalid IEEE 802 MAC Address format'
        ]
    },
    deviceType: {
        type: String,
        enum: ['laptop', 'phone', 'workstation', 'iot', 'server'],
        default: 'laptop'
    },
    assignedIp: {
        type: String,
        default: '0.0.0.0'
    },
    fsmState: {
        type: String,
        enum: ['INIT', 'SELECTING', 'REQUESTING', 'BOUND', 'RENEWING', 'REBINDING', 'RELEASED', 'EXPIRED', 'DECLINED'],
        default: 'INIT'
    },
    leaseExpiresAt: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);

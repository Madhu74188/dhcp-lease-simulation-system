/**
 * MongoDB Mongoose Model: Lease
 * Represents an active or historical DHCP lease record
 */
const mongoose = require('mongoose');

const leaseSchema = new mongoose.Schema({
    leaseId: {
        type: String,
        required: true,
        unique: true
    },
    clientMac: {
        type: String,
        required: true,
        uppercase: true
    },
    clientHostname: {
        type: String,
        required: true
    },
    allocatedIp: {
        type: String,
        required: true,
        match: [
            /^(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/,
            'Invalid IPv4 Address'
        ]
    },
    serverIp: {
        type: String,
        default: '192.168.1.1'
    },
    leaseDurationSecs: {
        type: Number,
        default: 120
    },
    t1Secs: {
        type: Number,
        default: 60
    },
    t2Secs: {
        type: Number,
        default: 105
    },
    status: {
        type: String,
        enum: ['OFFERED', 'BOUND', 'RENEWED', 'EXPIRED', 'RELEASED', 'DECLINED'],
        default: 'BOUND'
    },
    startTime: {
        type: Number,
        required: true
    },
    expiresAt: {
        type: Number,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Lease', leaseSchema);

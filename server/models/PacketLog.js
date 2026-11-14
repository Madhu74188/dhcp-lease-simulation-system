/**
 * MongoDB Mongoose Model: PacketLog
 * Audit log of all transmitted DHCP and ARP protocol packets
 */
const mongoose = require('mongoose');

const packetLogSchema = new mongoose.Schema({
    packetId: {
        type: String,
        required: true,
        unique: true
    },
    messageType: {
        type: String,
        required: true,
        enum: ['DHCPDISCOVER', 'DHCPOFFER', 'DHCPREQUEST', 'DHCPACK', 'DHCPNAK', 'DHCPDECLINE', 'DHCPRELEASE', 'ARP_PROBE', 'ARP_REPLY']
    },
    xid: {
        type: String,
        required: true
    },
    srcIp: String,
    dstIp: String,
    srcMac: String,
    dstMac: String,
    ciaddr: String,
    yiaddr: String,
    senderRole: String,
    senderName: String,
    targetRole: String,
    targetName: String,
    summary: String,
    simTime: Number,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('PacketLog', packetLogSchema);

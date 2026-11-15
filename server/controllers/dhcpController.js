/**
 * DHCP Controller for Express API & MongoDB Operations
 * Manages devices, DORA handshake, lease records, IP pool, and conflict quarantine
 */
const Device = require('../models/Device');
const Lease = require('../models/Lease');
const IpPool = require('../models/IpPool');
const PacketLog = require('../models/PacketLog');

// In-Memory Fallback Cache for Zero-Downtime Resilience
let memoryDevices = [
    { deviceId: 'dev-1', hostname: 'Laptop-Alpha', macAddress: '00:1E:67:98:2A:1B', deviceType: 'laptop', assignedIp: '0.0.0.0', fsmState: 'INIT' },
    { deviceId: 'dev-2', hostname: 'iPhone-15', macAddress: 'F0:18:98:4C:55:02', deviceType: 'phone', assignedIp: '0.0.0.0', fsmState: 'INIT' },
    { deviceId: 'dev-3', hostname: 'Workstation-Pro', macAddress: '3C:D9:2B:11:80:A3', deviceType: 'workstation', assignedIp: '0.0.0.0', fsmState: 'INIT' },
    { deviceId: 'dev-4', hostname: 'IoT-SmartSensor', macAddress: 'B8:27:EB:44:9C:F4', deviceType: 'iot', assignedIp: '0.0.0.0', fsmState: 'INIT' }
];

let memoryPool = [];
for (let i = 100; i <= 120; i++) {
    memoryPool.push({
        ipAddress: `192.168.1.${i}`,
        octet: i,
        status: 'AVAILABLE',
        allocatedToMac: null,
        allocatedToHost: null
    });
}

let memoryPackets = [];

// Helper to determine if MongoDB is active
const isMongoConnected = () => {
    const mongoose = require('mongoose');
    return mongoose.connection.readyState === 1;
};

// 1. GET ALL DEVICES
exports.getDevices = async (req, res) => {
    try {
        if (isMongoConnected()) {
            let devices = await Device.find();
            if (devices.length === 0) {
                devices = await Device.insertMany(memoryDevices);
            }
            return res.json({ success: true, data: devices });
        }
        res.json({ success: true, data: memoryDevices });
    } catch (err) {
        res.json({ success: true, data: memoryDevices });
    }
};

// 2. ADD NEW DEVICE (With Form Validation)
exports.addDevice = async (req, res) => {
    const { hostname, macAddress, deviceType } = req.body;

    // Strict Regex Validation
    const ipRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    const macRegex = /^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}$/;

    if (!hostname || !ipRegex.test(hostname)) {
        return res.status(400).json({ success: false, error: 'Invalid RFC 1123 Hostname' });
    }
    if (!macAddress || !macRegex.test(macAddress)) {
        return res.status(400).json({ success: false, error: 'Invalid IEEE 802 MAC Address format' });
    }

    const newDev = {
        deviceId: 'dev-' + (memoryDevices.length + 1),
        hostname,
        macAddress: macAddress.toUpperCase(),
        deviceType: deviceType || 'laptop',
        assignedIp: '0.0.0.0',
        fsmState: 'INIT'
    };

    memoryDevices.push(newDev);

    if (isMongoConnected()) {
        try {
            await Device.create(newDev);
        } catch (e) {
            console.error('Mongo save device error', e.message);
        }
    }

    res.json({ success: true, data: newDev });
};

// 3. GET IP POOL STATUS
exports.getIpPool = async (req, res) => {
    try {
        if (isMongoConnected()) {
            let pool = await IpPool.find().sort({ octet: 1 });
            if (pool.length === 0) {
                pool = await IpPool.insertMany(memoryPool);
            }
            return res.json({ success: true, data: pool });
        }
        res.json({ success: true, data: memoryPool });
    } catch (err) {
        res.json({ success: true, data: memoryPool });
    }
};

// 4. TRIGGER DORA HANDSHAKE (Discover ➔ Offer ➔ Request ➔ ACK)
exports.triggerDora = async (req, res) => {
    const { deviceId } = req.body;
    let dev = memoryDevices.find(d => d.deviceId === deviceId);

    if (!dev && isMongoConnected()) {
        dev = await Device.findOne({ deviceId });
    }
    if (!dev) {
        return res.status(404).json({ success: false, error: 'Device not found' });
    }

    // Find available IP from pool
    let freeIp = memoryPool.find(p => p.status === 'AVAILABLE');
    if (!freeIp) {
        return res.status(400).json({ success: false, error: 'Allocation Error: IP Address Pool Exhausted!' });
    }

    // Allocate IP
    freeIp.status = 'BOUND';
    freeIp.allocatedToMac = dev.macAddress;
    freeIp.allocatedToHost = dev.hostname;

    dev.assignedIp = freeIp.ipAddress;
    dev.fsmState = 'BOUND';

    // Log DORA packets
    const now = Date.now();
    const doraPackets = [
        { type: 'DHCPDISCOVER', desc: `${dev.hostname} broadcast DHCPDISCOVER to 255.255.255.255` },
        { type: 'DHCPOFFER', desc: `DHCP Server offered ${freeIp.ipAddress} to ${dev.macAddress}` },
        { type: 'DHCPREQUEST', desc: `${dev.hostname} requested offered IP ${freeIp.ipAddress}` },
        { type: 'DHCPACK', desc: `Server committed lease for ${freeIp.ipAddress} (Duration: 120s)` }
    ];

    doraPackets.forEach(p => memoryPackets.unshift({ ...p, timestamp: new Date() }));

    // Sync to MongoDB if connected
    if (isMongoConnected()) {
        try {
            await Device.updateOne({ deviceId: dev.deviceId }, { assignedIp: dev.assignedIp, fsmState: 'BOUND' });
            await IpPool.updateOne({ ipAddress: freeIp.ipAddress }, { status: 'BOUND', allocatedToMac: dev.macAddress, allocatedToHost: dev.hostname });
            await Lease.create({
                leaseId: 'lease-' + Date.now(),
                clientMac: dev.macAddress,
                clientHostname: dev.hostname,
                allocatedIp: freeIp.ipAddress,
                startTime: Math.floor(now / 1000),
                expiresAt: Math.floor(now / 1000) + 120
            });
        } catch (e) {
            console.error('Mongo sync error', e.message);
        }
    }

    res.json({
        success: true,
        allocatedIp: freeIp.ipAddress,
        device: dev,
        packets: doraPackets
    });
};

// 5. TRIGGER CONFLICT & DECLINE
exports.triggerConflict = async (req, res) => {
    const { deviceId } = req.body;
    let dev = memoryDevices.find(d => d.deviceId === deviceId);

    if (dev) {
        const conflictedIp = dev.assignedIp !== '0.0.0.0' ? dev.assignedIp : '192.168.1.100';
        dev.assignedIp = '0.0.0.0';
        dev.fsmState = 'DECLINED';

        // Quarantine IP in pool
        const poolEntry = memoryPool.find(p => p.ipAddress === conflictedIp);
        if (poolEntry) {
            poolEntry.status = 'CONFLICTED';
            poolEntry.conflictReason = 'ARP collision detected by client probe';
        }

        memoryPackets.unshift({
            type: 'DHCPDECLINE',
            desc: `Client ${dev.hostname} detected ARP Collision! Quarantined ${conflictedIp}`,
            timestamp: new Date()
        });

        if (isMongoConnected()) {
            try {
                await Device.updateOne({ deviceId: dev.deviceId }, { assignedIp: '0.0.0.0', fsmState: 'DECLINED' });
                await IpPool.updateOne({ ipAddress: conflictedIp }, { status: 'CONFLICTED', conflictReason: 'ARP probe collision' });
            } catch (e) {}
        }
    }

    res.json({ success: true, message: 'Conflict detected, DHCPDECLINE issued, address quarantined.' });
};

// 6. TRIGGER LEASE RELEASE
exports.releaseLease = async (req, res) => {
    const { deviceId } = req.body;
    let dev = memoryDevices.find(d => d.deviceId === deviceId);

    if (dev && dev.assignedIp !== '0.0.0.0') {
        const releasedIp = dev.assignedIp;
        dev.assignedIp = '0.0.0.0';
        dev.fsmState = 'RELEASED';

        const poolEntry = memoryPool.find(p => p.ipAddress === releasedIp);
        if (poolEntry) {
            poolEntry.status = 'AVAILABLE';
            poolEntry.allocatedToMac = null;
            poolEntry.allocatedToHost = null;
        }

        memoryPackets.unshift({
            type: 'DHCPRELEASE',
            desc: `Client ${dev.hostname} gracefully released IP ${releasedIp}`,
            timestamp: new Date()
        });

        if (isMongoConnected()) {
            try {
                await Device.updateOne({ deviceId: dev.deviceId }, { assignedIp: '0.0.0.0', fsmState: 'RELEASED' });
                await IpPool.updateOne({ ipAddress: releasedIp }, { status: 'AVAILABLE', allocatedToMac: null, allocatedToHost: null });
            } catch (e) {}
        }
    }

    res.json({ success: true, message: 'Lease released, returned to available pool.' });
};

// 7. SYNC LIVE UI ACTIONS DIRECTLY TO MONGODB ATLAS
exports.syncLease = async (req, res) => {
    try {
        const { deviceId, hostname, mac, currentIp, fsmState, action } = req.body;
        console.log(`[MongoDB Atlas Sync] Device: ${hostname} (${mac}) -> IP: ${currentIp} [State: ${fsmState}]`);

        if (isMongoConnected()) {
            await Device.findOneAndUpdate(
                { deviceId },
                {
                    deviceId,
                    hostname: hostname || deviceId,
                    macAddress: mac,
                    assignedIp: currentIp || '0.0.0.0',
                    fsmState: fsmState || 'BOUND'
                },
                { upsert: true, new: true }
            );

            if (currentIp && currentIp !== '0.0.0.0') {
                const nowSecs = Math.floor(Date.now() / 1000);
                await Lease.findOneAndUpdate(
                    { clientMac: mac },
                    {
                        leaseId: 'lease-' + (mac ? mac.replace(/[:-]/g, '') : Date.now()),
                        clientMac: mac,
                        clientHostname: hostname || deviceId,
                        allocatedIp: currentIp,
                        status: fsmState === 'BOUND' ? 'BOUND' : (fsmState === 'DECLINED' ? 'DECLINED' : 'RELEASED'),
                        leaseDurationSecs: 120,
                        t1Secs: 60,
                        t2Secs: 105,
                        startTime: nowSecs,
                        expiresAt: nowSecs + 120
                    },
                    { upsert: true, new: true }
                );

                await IpPool.findOneAndUpdate(
                    { ipAddress: currentIp },
                    {
                        ipAddress: currentIp,
                        status: fsmState === 'DECLINED' ? 'CONFLICTED' : (fsmState === 'BOUND' ? 'BOUND' : 'AVAILABLE'),
                        allocatedToMac: fsmState === 'BOUND' ? mac : null,
                        allocatedToHost: fsmState === 'BOUND' ? (hostname || deviceId) : null
                    },
                    { upsert: true }
                );
            }
        }

        res.json({ success: true, message: 'Synced to MongoDB Atlas successfully' });
    } catch (err) {
        console.error('Atlas sync error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

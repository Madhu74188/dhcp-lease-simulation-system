const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

let uri = process.env.MONGODB_URI;
if (!uri) {
    try {
        const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
        const match = envContent.match(/MONGODB_URI=(.*)/);
        if (match && match[1]) {
            uri = match[1].trim();
        }
    } catch (e) {}
}
console.log('Connecting to Atlas:', uri.replace(/:([^@]+)@/, ':****@'));

const LeaseSchema = new mongoose.Schema({
    ip: String,
    mac: String,
    hostname: String,
    leaseDuration: Number,
    state: String,
    allocatedAt: { type: Date, default: Date.now },
    expiresAt: Date
});

const DeviceSchema = new mongoose.Schema({
    deviceId: String,
    hostname: String,
    mac: String,
    type: String,
    currentIp: String,
    fsmState: String
});

const IpPoolSchema = new mongoose.Schema({
    ip: String,
    status: String,
    assignedToMac: String
});

const PacketLogSchema = new mongoose.Schema({
    type: String,
    source: String,
    destination: String,
    offeredIp: String,
    timestamp: { type: Date, default: Date.now }
});

const Lease = mongoose.model('Lease', LeaseSchema);
const Device = mongoose.model('Device', DeviceSchema);
const IpPool = mongoose.model('IpPool', IpPoolSchema);
const PacketLog = mongoose.model('PacketLog', PacketLogSchema);

async function run() {
    try {
        await mongoose.connect(uri);
        console.log('✓ Successfully connected to MongoDB Atlas!');

        // Insert / update initial sample records so database and collections appear in Atlas
        await Device.deleteMany({});
        await Device.insertMany([
            { deviceId: 'dev-1', hostname: 'Laptop-Alpha', mac: '00:1E:67:98:2A:1B', type: 'laptop', currentIp: '192.168.1.101', fsmState: 'BOUND' },
            { deviceId: 'dev-2', hostname: 'iPhone-15', mac: 'F0:18:98:33:AA:01', type: 'phone', currentIp: '0.0.0.0', fsmState: 'INIT' },
            { deviceId: 'dev-3', hostname: 'Workstation-Pro', mac: '00:50:56:C0:00:08', type: 'desktop', currentIp: '0.0.0.0', fsmState: 'INIT' },
            { deviceId: 'dev-4', hostname: 'IoT-SmartSensor', mac: 'B8:27:EB:49:8C:22', type: 'iot', currentIp: '0.0.0.0', fsmState: 'INIT' }
        ]);
        console.log('✓ Populated devices collection');

        await Lease.deleteMany({});
        await Lease.insertMany([
            {
                ip: '192.168.1.101',
                mac: '00:1E:67:98:2A:1B',
                hostname: 'Laptop-Alpha',
                leaseDuration: 120,
                state: 'BOUND',
                allocatedAt: new Date(),
                expiresAt: new Date(Date.now() + 120000)
            }
        ]);
        console.log('✓ Populated leases collection');

        await IpPool.deleteMany({});
        const pool = [];
        for (let i = 100; i <= 130; i++) {
            const ip = `192.168.1.${i}`;
            pool.push({
                ip,
                status: ip === '192.168.1.101' ? 'LEASED' : 'AVAILABLE',
                assignedToMac: ip === '192.168.1.101' ? '00:1E:67:98:2A:1B' : null
            });
        }
        await IpPool.insertMany(pool);
        console.log('✓ Populated ippools collection');

        await PacketLog.deleteMany({});
        await PacketLog.insertMany([
            { type: 'DHCPDISCOVER', source: '00:1E:67:98:2A:1B', destination: '255.255.255.255', offeredIp: '0.0.0.0' },
            { type: 'DHCPOFFER', source: '192.168.1.1', destination: '00:1E:67:98:2A:1B', offeredIp: '192.168.1.101' },
            { type: 'DHCPREQUEST', source: '00:1E:67:98:2A:1B', destination: '255.255.255.255', offeredIp: '192.168.1.101' },
            { type: 'DHCPACK', source: '192.168.1.1', destination: '00:1E:67:98:2A:1B', offeredIp: '192.168.1.101' }
        ]);
        console.log('✓ Populated packetlogs collection');

        console.log('\n🎉 ALL DONE! dhcp_simulation database is now LIVE in MongoDB Atlas!');
        process.exit(0);
    } catch (err) {
        console.error('Error connecting to Atlas:', err.message);
        process.exit(1);
    }
}

run();

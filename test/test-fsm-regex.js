/**
 * Network Address Allocation and DHCP Lease Simulation System
 * Automated Test Suite for Regular Expressions, FSM, and DHCP Protocol Engine
 */

const assert = require('assert');
const RegexValidator = require('../src/js/regex-validator');
const { Packet, PacketFactory, DHCP_MESSAGE_TYPES } = require('../src/js/packet');
const { LEASE_STATES, FiniteStateMachine } = require('../src/js/fsm');
const DhcpServer = require('../src/js/dhcp-server');
const DhcpClient = require('../src/js/client');
const DhcpSimulation = require('../src/js/simulation');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
    }
}

console.log('\n======================================================');
console.log('NET-DHCP AUTOMATED TEST SUITE');
console.log('======================================================\n');

// 1. Regular Expression Validation Tests
console.log('--- 1. Regular Expression Validation ---');

runTest('IPv4: Valid addresses (standard class A, B, C, edge cases)', () => {
    assert.strictEqual(RegexValidator.validateIpv4('192.168.1.1'), true);
    assert.strictEqual(RegexValidator.validateIpv4('10.0.0.1'), true);
    assert.strictEqual(RegexValidator.validateIpv4('172.16.50.254'), true);
    assert.strictEqual(RegexValidator.validateIpv4('0.0.0.0'), true);
    assert.strictEqual(RegexValidator.validateIpv4('255.255.255.255'), true);
});

runTest('IPv4: Reject invalid octets and malformed strings', () => {
    assert.strictEqual(RegexValidator.validateIpv4('192.168.1.256'), false);
    assert.strictEqual(RegexValidator.validateIpv4('192.168.1.999'), false);
    assert.strictEqual(RegexValidator.validateIpv4('192.168.1'), false);
    assert.strictEqual(RegexValidator.validateIpv4('192.168.1.1.1'), false);
    assert.strictEqual(RegexValidator.validateIpv4('abc.def.ghi.jkl'), false);
    assert.strictEqual(RegexValidator.validateIpv4('192.168.1.-1'), false);
});

runTest('MAC Address: Validate Colon, Hyphen, and Cisco dotted formats', () => {
    assert.strictEqual(RegexValidator.validateMac('00:1A:2B:3C:4D:5E'), true);
    assert.strictEqual(RegexValidator.validateMac('00-1A-2B-3C-4D-5E'), true);
    assert.strictEqual(RegexValidator.validateMac('001a.2b3c.4d5e'), true);
    assert.strictEqual(RegexValidator.validateMac('AA:BB:CC:DD:EE:FF'), true);
});

runTest('MAC Address: Reject invalid lengths and characters', () => {
    assert.strictEqual(RegexValidator.validateMac('00:1A:2B:3C:4D'), false);
    assert.strictEqual(RegexValidator.validateMac('00:1A:2B:3C:4D:5Z'), false);
    assert.strictEqual(RegexValidator.validateMac('001A-2B3C-4D5E'), false);
    assert.strictEqual(RegexValidator.validateMac('random-string'), false);
});

runTest('MAC Address: Normalize and detect Multicast bits', () => {
    assert.strictEqual(RegexValidator.normalizeMac('00-1a-2b-3c-4d-5e'), '00:1A:2B:3C:4D:5E');
    assert.strictEqual(RegexValidator.normalizeMac('001a.2b3c.4d5e'), '00:1A:2B:3C:4D:5E');
    // 01:00:5E:... is multicast (LSB of first byte is 1)
    assert.strictEqual(RegexValidator.isMulticastMac('01:00:5E:00:00:01'), true);
    // 00:1A:2B:... is unicast (LSB of first byte is 0)
    assert.strictEqual(RegexValidator.isMulticastMac('00:1A:2B:3C:4D:5E'), false);
});

runTest('Subnet Mask: Validate contiguous netmasks', () => {
    assert.strictEqual(RegexValidator.validateSubnetMask('255.255.255.0'), true);
    assert.strictEqual(RegexValidator.validateSubnetMask('255.255.0.0'), true);
    assert.strictEqual(RegexValidator.validateSubnetMask('255.0.0.0'), true);
    assert.strictEqual(RegexValidator.validateSubnetMask('255.255.255.192'), true);
    assert.strictEqual(RegexValidator.validateSubnetMask('255.255.254.0'), true);
});

runTest('Subnet Mask: Reject discontiguous or invalid masks', () => {
    assert.strictEqual(RegexValidator.validateSubnetMask('255.255.255.1'), false);
    assert.strictEqual(RegexValidator.validateSubnetMask('255.255.0.255'), false);
    assert.strictEqual(RegexValidator.validateSubnetMask('255.240.255.0'), false);
    assert.strictEqual(RegexValidator.validateSubnetMask('256.255.255.0'), false);
});

runTest('CIDR: Validate prefix notation', () => {
    assert.strictEqual(RegexValidator.validateCidr('192.168.1.0/24'), true);
    assert.strictEqual(RegexValidator.validateCidr('10.0.0.0/8'), true);
    assert.strictEqual(RegexValidator.validateCidr('192.168.1.0/33'), false);
    assert.strictEqual(RegexValidator.validateCidr('192.168.1.0/0'), false);
});

runTest('Hostname: RFC 1123 label validation', () => {
    assert.strictEqual(RegexValidator.validateHostname('laptop-alpha'), true);
    assert.strictEqual(RegexValidator.validateHostname('node-01.lan'), true);
    assert.strictEqual(RegexValidator.validateHostname('-bad-start'), false);
    assert.strictEqual(RegexValidator.validateHostname('bad-end-'), false);
    assert.strictEqual(RegexValidator.validateHostname('has_underscore'), false);
});

// 2. IP Math & Subnet Calculations
console.log('\n--- 2. IP Math & Subnet Utilities ---');

runTest('IP to Integer and back', () => {
    const intVal = RegexValidator.ipToInt('192.168.1.1');
    assert.strictEqual(RegexValidator.intToIp(intVal), '192.168.1.1');
});

runTest('Subnet Membership calculation', () => {
    assert.strictEqual(RegexValidator.isIpInSubnet('192.168.1.50', '192.168.1.1', '255.255.255.0'), true);
    assert.strictEqual(RegexValidator.isIpInSubnet('192.168.2.50', '192.168.1.1', '255.255.255.0'), false);
    assert.strictEqual(RegexValidator.maskToCidr('255.255.255.0'), 24);
    assert.strictEqual(RegexValidator.cidrToMask(24), '255.255.255.0');
});

// 3. Finite-State Machine (FSM) Lifecycle Tests
console.log('\n--- 3. Client Finite-State Machine (FSM) ---');

runTest('FSM: Initial state is INIT', () => {
    const fsm = new FiniteStateMachine('test-client');
    assert.strictEqual(fsm.getState(), 'INIT');
    assert.strictEqual(fsm.isBound(), false);
});

runTest('FSM: Complete DORA Lifecycle Transitions', () => {
    const fsm = new FiniteStateMachine('test-client');
    
    // 1. INIT -> SELECTING (SEND_DISCOVER)
    fsm.transition('SELECTING', 'SEND_DISCOVER');
    assert.strictEqual(fsm.getState(), 'SELECTING');

    // 2. SELECTING -> REQUESTING (RECEIVE_OFFER)
    fsm.transition('REQUESTING', 'RECEIVE_OFFER');
    assert.strictEqual(fsm.getState(), 'REQUESTING');

    // 3. REQUESTING -> BOUND (RECEIVE_ACK)
    fsm.transition('BOUND', 'RECEIVE_ACK');
    assert.strictEqual(fsm.getState(), 'BOUND');
    assert.strictEqual(fsm.isBound(), true);

    // 4. BOUND -> RENEWING (TIMER_T1_EXPIRED)
    fsm.transition('RENEWING', 'TIMER_T1_EXPIRED');
    assert.strictEqual(fsm.getState(), 'RENEWING');
    assert.strictEqual(fsm.isBound(), true);

    // 5. RENEWING -> REBINDING (TIMER_T2_EXPIRED)
    fsm.transition('REBINDING', 'TIMER_T2_EXPIRED');
    assert.strictEqual(fsm.getState(), 'REBINDING');
    assert.strictEqual(fsm.isBound(), true);

    // 6. REBINDING -> EXPIRED (LEASE_EXPIRED)
    fsm.transition('EXPIRED', 'LEASE_EXPIRED');
    assert.strictEqual(fsm.getState(), 'EXPIRED');
    assert.strictEqual(fsm.isBound(), false);

    // 7. EXPIRED -> INIT (RESET)
    fsm.transition('INIT', 'RESET');
    assert.strictEqual(fsm.getState(), 'INIT');
});

runTest('FSM: Graceful Release (BOUND -> RELEASED -> INIT)', () => {
    const fsm = new FiniteStateMachine('test-client', 'BOUND');
    fsm.transition('RELEASED', 'SEND_RELEASE');
    assert.strictEqual(fsm.getState(), 'RELEASED');
    fsm.transition('INIT', 'RESET');
    assert.strictEqual(fsm.getState(), 'INIT');
});

runTest('FSM: Address Conflict (REQUESTING -> DECLINED -> INIT)', () => {
    const fsm = new FiniteStateMachine('test-client', 'REQUESTING');
    fsm.transition('DECLINED', 'CONFLICT_DETECTED');
    assert.strictEqual(fsm.getState(), 'DECLINED');
    fsm.transition('INIT', 'BACKOFF_COMPLETE');
    assert.strictEqual(fsm.getState(), 'INIT');
});

// 4. DHCP Server & IP Pool Management Tests
console.log('\n--- 4. DHCP Server & Pool Allocation ---');

runTest('Server: Pool initialization and capacity', () => {
    const server = new DhcpServer({
        poolStart: '192.168.1.100',
        poolEnd: '192.168.1.104'
    });
    const stats = server.updatePoolStatistics();
    assert.strictEqual(stats.total, 5);
    assert.strictEqual(stats.available, 5);
    assert.strictEqual(stats.active, 0);
});

runTest('Server: Dynamic IP allocation and offer', () => {
    const server = new DhcpServer({
        poolStart: '192.168.1.100',
        poolEnd: '192.168.1.110'
    });
    const client = new DhcpClient({ hostname: 'Client-1', mac: '00:1A:2B:3C:4D:01' });
    const discover = client.startAcquisition(0);

    const offer = server.handleDiscover(discover, 0);
    assert.notStrictEqual(offer, null);
    assert.strictEqual(offer.messageType, 2); // DHCPOFFER
    assert.strictEqual(offer.yiaddr, '192.168.1.100');

    // Handle Request & ACK
    const request = client.handleOffer(offer, 0);
    assert.notStrictEqual(request, null);
    assert.strictEqual(request.messageType, 3); // DHCPREQUEST

    const ack = server.handleRequest(request, 0);
    assert.notStrictEqual(ack, null);
    assert.strictEqual(ack.messageType, 5); // DHCPACK
    assert.strictEqual(ack.yiaddr, '192.168.1.100');

    client.handleAck(ack, 0);
    assert.strictEqual(client.getState(), 'BOUND');
    assert.strictEqual(client.ip, '192.168.1.100');

    const stats = server.updatePoolStatistics();
    assert.strictEqual(stats.active, 1);
    assert.strictEqual(stats.available, 10);
});

runTest('Server: Pool Exhaustion Handling', () => {
    const server = new DhcpServer({
        poolStart: '192.168.1.100',
        poolEnd: '192.168.1.100' // Single IP pool
    });

    const client1 = new DhcpClient({ hostname: 'Client-1', mac: '00:1A:2B:3C:4D:01' });
    const client2 = new DhcpClient({ hostname: 'Client-2', mac: '00:1A:2B:3C:4D:02' });

    // Client 1 claims the only IP
    const d1 = client1.startAcquisition(0);
    const o1 = server.handleDiscover(d1, 0);
    const r1 = client1.handleOffer(o1, 0);
    const a1 = server.handleRequest(r1, 0);
    client1.handleAck(a1, 0);

    // Client 2 requests an IP -> Pool Exhaustion!
    const d2 = client2.startAcquisition(0);
    const o2 = server.handleDiscover(d2, 0);
    assert.strictEqual(o2, null); // Server drops request due to pool exhaustion
    assert.strictEqual(server.stats.poolExhaustionEvents, 1);
});

runTest('Server: Conflict Quarantine upon DHCPDECLINE', () => {
    const server = new DhcpServer({
        poolStart: '192.168.1.100',
        poolEnd: '192.168.1.105'
    });
    const client = new DhcpClient({ hostname: 'Client-1', mac: '00:1A:2B:3C:4D:01' });
    
    // Simulate Decline
    const decline = PacketFactory.createDecline(client, '192.168.1.100', server.ip, 'ARP Probe collision');
    server.handleDecline(decline, 0);

    const poolEntry = server.addressPool.get('192.168.1.100');
    assert.strictEqual(poolEntry.status, 'CONFLICTED');
    assert.strictEqual(server.stats.conflictsDetected, 1);

    // Make sure next discover gets .101, avoiding the conflicted .100
    const d = client.startAcquisition(0);
    const o = server.handleDiscover(d, 0);
    assert.strictEqual(o.yiaddr, '192.168.1.101');
});

console.log('\n======================================================');
console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
console.log('======================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}

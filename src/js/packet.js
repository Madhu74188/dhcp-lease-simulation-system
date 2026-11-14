/**
 * Network Address Allocation and DHCP Lease Simulation System
 * RFC 2131 DHCP Packet & Message Specification
 * 
 * Implements complete DHCP / BOOTP packet structures, options encoding,
 * transaction tracking, and helper constructors for DORA and ARP conflict packets.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./regex-validator'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./regex-validator'));
    } else {
        root.DhcpPacket = factory(root.RegexValidator);
    }
}(typeof self !== 'undefined' ? self : this, function (RegexValidator) {

    // DHCP Message Types (Option 53)
    const DHCP_MESSAGE_TYPES = {
        1: { name: 'DHCPDISCOVER', code: 1, dir: 'C->S', desc: 'Client broadcast to locate available DHCP servers' },
        2: { name: 'DHCPOFFER',    code: 2, dir: 'S->C', desc: 'Server offer of configuration parameters for client' },
        3: { name: 'DHCPREQUEST',  code: 3, dir: 'C->S', desc: 'Client broadcast requesting offered parameters or extending lease' },
        4: { name: 'DHCPDECLINE',  code: 4, dir: 'C->S', desc: 'Client notification to server that network address is already in use (conflict)' },
        5: { name: 'DHCPACK',      code: 5, dir: 'S->C', desc: 'Server acknowledgment with committed network address and configuration parameters' },
        6: { name: 'DHCPNAK',      code: 6, dir: 'S->C', desc: 'Server negative acknowledgment refusing lease or signaling invalid network address' },
        7: { name: 'DHCPRELEASE',  code: 7, dir: 'C->S', desc: 'Client relinquishing network address and canceling remaining lease' },
        8: { name: 'DHCPINFORM',   code: 8, dir: 'C->S', desc: 'Client querying local configuration parameters without requesting an IP address' },
        
        // Special Simulation Protocol Messages
        90: { name: 'ARP_PROBE',   code: 90, dir: 'C->ALL', desc: 'ARP Probe broadcast to detect potential address collisions before binding' },
        91: { name: 'ARP_REPLY',   code: 91, dir: 'H->C',   desc: 'ARP Reply from conflicting host asserting ownership of offered IP' }
    };

    const DHCP_OPCODES = {
        BOOTREQUEST: 1,
        BOOTREPLY: 2
    };

    /**
     * Generate a cryptographically pseudo-random 32-bit transaction ID (xid)
     */
    function generateXid() {
        const rand = Math.floor(Math.random() * 0xFFFFFFFF);
        return '0x' + rand.toString(16).padStart(8, '0').toUpperCase();
    }

    /**
     * Packet Class
     */
    class Packet {
        constructor(params = {}) {
            this.id = params.id || ('pkt-' + Math.random().toString(36).substring(2, 9));
            this.timestamp = params.timestamp || Date.now();
            this.simTick = params.simTick || 0;

            // Network Layer Headers
            this.srcMac = params.srcMac || '00:00:00:00:00:00';
            this.dstMac = params.dstMac || 'FF:FF:FF:FF:FF:FF';
            this.srcIp = params.srcIp || '0.0.0.0';
            this.dstIp = params.dstIp || '255.255.255.255';
            this.srcPort = params.srcPort || 68; // Client default UDP port
            this.dstPort = params.dstPort || 67; // Server default UDP port

            // RFC 2131 BOOTP / DHCP Protocol Header Fields
            this.op = params.op || DHCP_OPCODES.BOOTREQUEST; // 1 = BOOTREQUEST, 2 = BOOTREPLY
            this.htype = params.htype || 1;                  // 1 = 10Mb Ethernet
            this.hlen = params.hlen || 6;                    // 6 octets MAC
            this.hops = params.hops || 0;                    // Relay agent hop count
            this.xid = params.xid || generateXid();          // 32-bit transaction ID
            this.secs = params.secs || 0;                    // Seconds elapsed since acquisition began
            this.flags = params.flags || 0x8000;             // 0x8000 = Broadcast, 0x0000 = Unicast
            this.ciaddr = params.ciaddr || '0.0.0.0';        // Client IP address (BOUND/RENEW)
            this.yiaddr = params.yiaddr || '0.0.0.0';        // 'Your' (client) IP address
            this.siaddr = params.siaddr || '0.0.0.0';        // Next bootstrap server IP
            this.giaddr = params.giaddr || '0.0.0.0';        // Relay agent IP address
            this.chaddr = params.chaddr || params.srcMac || '00:00:00:00:00:00'; // Client Hardware MAC
            this.sname = params.sname || '';                 // Optional server host name
            this.file = params.file || '';                   // Boot file name

            // DHCP Options (RFC 2132)
            this.options = Object.assign({}, params.options || {});
            
            // Primary Message Type (Option 53)
            this.messageType = params.messageType || (this.options[53] ? this.options[53].code : 1);
            if (!this.options[53]) {
                this.options[53] = {
                    tag: 53,
                    name: 'DHCP Message Type',
                    code: this.messageType,
                    value: DHCP_MESSAGE_TYPES[this.messageType] ? DHCP_MESSAGE_TYPES[this.messageType].name : `Type ${this.messageType}`
                };
            }

            // Packet Simulation Metadata
            this.senderRole = params.senderRole || 'Client'; // Client, Server, RogueServer, Host
            this.senderName = params.senderName || 'Device';
            this.targetRole = params.targetRole || 'Server';
            this.targetName = params.targetName || 'DHCP Server';
            this.isBroadcast = this.dstIp === '255.255.255.255' || this.dstMac === 'FF:FF:FF:FF:FF:FF';
            this.isCorrupted = !!params.isCorrupted;
            this.corruptionReason = params.corruptionReason || null;
            this.status = 'transmitted'; // transmitted, delivered, dropped, rejected
        }

        /**
         * Human-readable label for sequence diagram
         */
        getTypeName() {
            return DHCP_MESSAGE_TYPES[this.messageType] ? DHCP_MESSAGE_TYPES[this.messageType].name : `DHCP #${this.messageType}`;
        }

        getTypeDescription() {
            return DHCP_MESSAGE_TYPES[this.messageType] ? DHCP_MESSAGE_TYPES[this.messageType].desc : 'Custom DHCP Message';
        }

        getSummary() {
            const type = this.getTypeName();
            if (this.messageType === 1) { // DISCOVER
                return `${type} from ${this.chaddr} (xid: ${this.xid})`;
            } else if (this.messageType === 2) { // OFFER
                return `${type}: ${this.yiaddr} offered by ${this.options[54] ? this.options[54].value : this.srcIp} to ${this.chaddr}`;
            } else if (this.messageType === 3) { // REQUEST
                const reqIp = this.options[50] ? this.options[50].value : (this.ciaddr !== '0.0.0.0' ? this.ciaddr : this.yiaddr);
                return `${type} for ${reqIp} (Server: ${this.options[54] ? this.options[54].value : 'Any'})`;
            } else if (this.messageType === 4) { // DECLINE
                return `${type}: IP ${this.options[50] ? this.options[50].value : this.ciaddr} conflicted!`;
            } else if (this.messageType === 5) { // ACK
                return `${type}: ${this.yiaddr} leased for ${this.options[51] ? this.options[51].value : 'default'}s`;
            } else if (this.messageType === 6) { // NAK
                return `${type}: Lease request rejected by ${this.srcIp} (${this.options[56] ? this.options[56].value : 'Not Available'})`;
            } else if (this.messageType === 7) { // RELEASE
                return `${type}: Client ${this.chaddr} released IP ${this.ciaddr}`;
            } else if (this.messageType === 90) { // ARP PROBE
                return `ARP Probe: Who has ${this.options[90] ? this.options[90].targetIp : this.yiaddr}? (From ${this.srcMac})`;
            } else if (this.messageType === 91) { // ARP REPLY
                return `ARP Collision: ${this.srcMac} claims IP ${this.srcIp}!`;
            }
            return `${type} (xid: ${this.xid})`;
        }

        /**
         * Validates packet headers using RegexValidator
         */
        validatePacket() {
            const errors = [];
            if (!RegexValidator.validateMac(this.srcMac)) {
                errors.push(`Invalid source MAC format: ${this.srcMac}`);
            }
            if (!RegexValidator.validateMac(this.chaddr)) {
                errors.push(`Invalid chaddr (client hardware MAC): ${this.chaddr}`);
            }
            if (!RegexValidator.validateIpv4(this.srcIp)) {
                errors.push(`Invalid source IP: ${this.srcIp}`);
            }
            if (!RegexValidator.validateIpv4(this.dstIp)) {
                errors.push(`Invalid destination IP: ${this.dstIp}`);
            }
            if (!RegexValidator.validateHexXid(this.xid)) {
                errors.push(`Invalid xid transaction format: ${this.xid}`);
            }
            return {
                valid: errors.length === 0,
                errors
            };
        }
    }

    /**
     * Factory methods for standard DHCP & ARP packets
     */
    const PacketFactory = {
        createDiscover(client, options = {}) {
            const xid = options.xid || generateXid();
            return new Packet({
                srcMac: client.mac,
                dstMac: 'FF:FF:FF:FF:FF:FF',
                srcIp: '0.0.0.0',
                dstIp: '255.255.255.255',
                srcPort: 68,
                dstPort: 67,
                op: DHCP_OPCODES.BOOTREQUEST,
                xid: xid,
                flags: 0x8000, // Broadcast
                chaddr: client.mac,
                messageType: 1,
                senderRole: 'Client',
                senderName: client.hostname || 'Client',
                targetRole: 'Server',
                targetName: 'DHCP Broadcast',
                options: {
                    53: { tag: 53, name: 'DHCP Message Type', code: 1, value: 'DHCPDISCOVER' },
                    55: { tag: 55, name: 'Parameter Request List', value: [1, 3, 6, 15, 51, 58, 59] },
                    12: { tag: 12, name: 'Host Name', value: client.hostname || 'Client' },
                    61: { tag: 61, name: 'Client Identifier', value: `01:${client.mac}` },
                    ...(options.requestedIp ? {
                        50: { tag: 50, name: 'Requested IP Address', value: options.requestedIp }
                    } : {})
                }
            });
        },

        createOffer(server, clientPacket, offeredIp, leaseDuration = 300) {
            const t1 = Math.floor(leaseDuration * 0.5);
            const t2 = Math.floor(leaseDuration * 0.875);
            const isBroadcast = (clientPacket.flags & 0x8000) !== 0 || clientPacket.ciaddr === '0.0.0.0';

            return new Packet({
                srcMac: server.mac,
                dstMac: isBroadcast ? 'FF:FF:FF:FF:FF:FF' : clientPacket.chaddr,
                srcIp: server.ip,
                dstIp: isBroadcast ? '255.255.255.255' : offeredIp,
                srcPort: 67,
                dstPort: 68,
                op: DHCP_OPCODES.BOOTREPLY,
                xid: clientPacket.xid,
                flags: clientPacket.flags,
                ciaddr: '0.0.0.0',
                yiaddr: offeredIp,
                siaddr: server.ip,
                chaddr: clientPacket.chaddr,
                messageType: 2,
                senderRole: server.isRogue ? 'RogueServer' : 'Server',
                senderName: server.name || 'DHCP Server',
                targetRole: 'Client',
                targetName: clientPacket.senderName,
                options: {
                    53: { tag: 53, name: 'DHCP Message Type', code: 2, value: 'DHCPOFFER' },
                    54: { tag: 54, name: 'Server Identifier', value: server.ip },
                    51: { tag: 51, name: 'IP Address Lease Time', value: leaseDuration },
                    58: { tag: 58, name: 'Renewal (T1) Time Value', value: t1 },
                    59: { tag: 59, name: 'Rebinding (T2) Time Value', value: t2 },
                    1:  { tag: 1,  name: 'Subnet Mask', value: server.subnetMask },
                    3:  { tag: 3,  name: 'Router (Default Gateway)', value: server.gateway },
                    6:  { tag: 6,  name: 'Domain Name Server', value: server.dns },
                    255:{ tag: 255,name: 'End Option', value: 'END' }
                }
            });
        },

        createRequest(client, offerPacket, isRenewal = false, isRebinding = false) {
            const serverId = offerPacket.options[54] ? offerPacket.options[54].value : offerPacket.srcIp;
            const targetIp = offerPacket.yiaddr || client.ip;
            const isUnicast = isRenewal && !isRebinding;

            return new Packet({
                srcMac: client.mac,
                dstMac: isUnicast ? offerPacket.srcMac : 'FF:FF:FF:FF:FF:FF',
                srcIp: isRenewal ? client.ip : '0.0.0.0',
                dstIp: isUnicast ? serverId : '255.255.255.255',
                srcPort: 68,
                dstPort: 67,
                op: DHCP_OPCODES.BOOTREQUEST,
                xid: offerPacket.xid || generateXid(),
                flags: isUnicast ? 0x0000 : 0x8000,
                ciaddr: isRenewal ? client.ip : '0.0.0.0',
                yiaddr: '0.0.0.0',
                chaddr: client.mac,
                messageType: 3,
                senderRole: 'Client',
                senderName: client.hostname,
                targetRole: isUnicast ? 'Server' : 'All',
                targetName: isUnicast ? 'DHCP Server (Unicast)' : 'DHCP Broadcast',
                options: {
                    53: { tag: 53, name: 'DHCP Message Type', code: 3, value: 'DHCPREQUEST' },
                    50: { tag: 50, name: 'Requested IP Address', value: targetIp },
                    ...(!isRenewal ? { 54: { tag: 54, name: 'Server Identifier', value: serverId } } : {}),
                    12: { tag: 12, name: 'Host Name', value: client.hostname },
                    61: { tag: 61, name: 'Client Identifier', value: `01:${client.mac}` },
                    55: { tag: 55, name: 'Parameter Request List', value: [1, 3, 6, 15, 51, 58, 59] }
                }
            });
        },

        createAck(server, requestPacket, leaseDuration = 300) {
            const reqIp = requestPacket.options[50] ? requestPacket.options[50].value : requestPacket.ciaddr;
            const t1 = Math.floor(leaseDuration * 0.5);
            const t2 = Math.floor(leaseDuration * 0.875);
            const isBroadcast = (requestPacket.flags & 0x8000) !== 0 || requestPacket.ciaddr === '0.0.0.0';

            return new Packet({
                srcMac: server.mac,
                dstMac: isBroadcast ? 'FF:FF:FF:FF:FF:FF' : requestPacket.chaddr,
                srcIp: server.ip,
                dstIp: isBroadcast ? '255.255.255.255' : reqIp,
                srcPort: 67,
                dstPort: 68,
                op: DHCP_OPCODES.BOOTREPLY,
                xid: requestPacket.xid,
                flags: requestPacket.flags,
                ciaddr: requestPacket.ciaddr,
                yiaddr: reqIp,
                siaddr: server.ip,
                chaddr: requestPacket.chaddr,
                messageType: 5,
                senderRole: server.isRogue ? 'RogueServer' : 'Server',
                senderName: server.name || 'DHCP Server',
                targetRole: 'Client',
                targetName: requestPacket.senderName,
                options: {
                    53: { tag: 53, name: 'DHCP Message Type', code: 5, value: 'DHCPACK' },
                    54: { tag: 54, name: 'Server Identifier', value: server.ip },
                    51: { tag: 51, name: 'IP Address Lease Time', value: leaseDuration },
                    58: { tag: 58, name: 'Renewal (T1) Time Value', value: t1 },
                    59: { tag: 59, name: 'Rebinding (T2) Time Value', value: t2 },
                    1:  { tag: 1,  name: 'Subnet Mask', value: server.subnetMask },
                    3:  { tag: 3,  name: 'Router (Default Gateway)', value: server.gateway },
                    6:  { tag: 6,  name: 'Domain Name Server', value: server.dns },
                    255:{ tag: 255,name: 'End Option', value: 'END' }
                }
            });
        },

        createNak(server, requestPacket, reason = 'Address Not Available or Invalid') {
            return new Packet({
                srcMac: server.mac,
                dstMac: 'FF:FF:FF:FF:FF:FF',
                srcIp: server.ip,
                dstIp: '255.255.255.255',
                srcPort: 67,
                dstPort: 68,
                op: DHCP_OPCODES.BOOTREPLY,
                xid: requestPacket.xid,
                flags: 0x8000,
                ciaddr: '0.0.0.0',
                yiaddr: '0.0.0.0',
                siaddr: server.ip,
                chaddr: requestPacket.chaddr,
                messageType: 6,
                senderRole: server.isRogue ? 'RogueServer' : 'Server',
                senderName: server.name || 'DHCP Server',
                targetRole: 'Client',
                targetName: requestPacket.senderName,
                options: {
                    53: { tag: 53, name: 'DHCP Message Type', code: 6, value: 'DHCPNAK' },
                    54: { tag: 54, name: 'Server Identifier', value: server.ip },
                    56: { tag: 56, name: 'Message / Rejection Reason', value: reason },
                    255:{ tag: 255,name: 'End Option', value: 'END' }
                }
            });
        },

        createDecline(client, offeredIp, serverIp, reason = 'Address collision detected via ARP probe') {
            return new Packet({
                srcMac: client.mac,
                dstMac: 'FF:FF:FF:FF:FF:FF',
                srcIp: '0.0.0.0',
                dstIp: '255.255.255.255',
                srcPort: 68,
                dstPort: 67,
                op: DHCP_OPCODES.BOOTREQUEST,
                xid: generateXid(),
                flags: 0x8000,
                ciaddr: '0.0.0.0',
                yiaddr: '0.0.0.0',
                chaddr: client.mac,
                messageType: 4,
                senderRole: 'Client',
                senderName: client.hostname,
                targetRole: 'Server',
                targetName: 'DHCP Server',
                options: {
                    53: { tag: 53, name: 'DHCP Message Type', code: 4, value: 'DHCPDECLINE' },
                    50: { tag: 50, name: 'Requested IP Address (Declined)', value: offeredIp },
                    54: { tag: 54, name: 'Server Identifier', value: serverIp },
                    56: { tag: 56, name: 'Decline Reason', value: reason },
                    61: { tag: 61, name: 'Client Identifier', value: `01:${client.mac}` }
                }
            });
        },

        createRelease(client, serverIp) {
            return new Packet({
                srcMac: client.mac,
                dstMac: 'FF:FF:FF:FF:FF:FF',
                srcIp: client.ip,
                dstIp: serverIp,
                srcPort: 68,
                dstPort: 67,
                op: DHCP_OPCODES.BOOTREQUEST,
                xid: generateXid(),
                flags: 0x0000,
                ciaddr: client.ip,
                yiaddr: '0.0.0.0',
                chaddr: client.mac,
                messageType: 7,
                senderRole: 'Client',
                senderName: client.hostname,
                targetRole: 'Server',
                targetName: 'DHCP Server',
                options: {
                    53: { tag: 53, name: 'DHCP Message Type', code: 7, value: 'DHCPRELEASE' },
                    54: { tag: 54, name: 'Server Identifier', value: serverIp },
                    61: { tag: 61, name: 'Client Identifier', value: `01:${client.mac}` }
                }
            });
        },

        createArpProbe(client, targetIp) {
            return new Packet({
                srcMac: client.mac,
                dstMac: 'FF:FF:FF:FF:FF:FF',
                srcIp: '0.0.0.0', // ARP probe has 0.0.0.0 as sender IP to avoid polluting caches
                dstIp: targetIp,
                op: 1, // ARP Request
                messageType: 90,
                senderRole: 'Client',
                senderName: client.hostname,
                targetRole: 'Network',
                targetName: 'ARP Broadcast Probe',
                options: {
                    90: { tag: 90, name: 'ARP Probe', targetIp: targetIp, senderMac: client.mac }
                }
            });
        },

        createArpReply(conflictingHost, targetClient, ip) {
            return new Packet({
                srcMac: conflictingHost.mac,
                dstMac: targetClient.mac,
                srcIp: ip,
                dstIp: '0.0.0.0',
                op: 2, // ARP Reply
                messageType: 91,
                senderRole: 'Host',
                senderName: conflictingHost.name || 'Conflicting Host',
                targetRole: 'Client',
                targetName: targetClient.hostname,
                options: {
                    91: { tag: 91, name: 'ARP Reply (Collision!)', ip: ip, claimingMac: conflictingHost.mac }
                }
            });
        }
    };

    return {
        Packet,
        PacketFactory,
        DHCP_MESSAGE_TYPES,
        DHCP_OPCODES,
        generateXid
    };
}));

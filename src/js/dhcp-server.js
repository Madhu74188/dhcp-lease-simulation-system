/**
 * Network Address Allocation and DHCP Lease Simulation System
 * DHCP Server Simulation Engine
 * 
 * Manages RFC 2131 IP address pools, lease allocations, static reservations,
 * T1/T2 timer calculations, conflict quarantines, and packet message handlers.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./regex-validator', './packet'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./regex-validator'), require('./packet'));
    } else {
        root.DhcpServer = factory(root.RegexValidator, root.DhcpPacket);
    }
}(typeof self !== 'undefined' ? self : this, function (RegexValidator, DhcpPacket) {

    const { PacketFactory } = DhcpPacket;

    class DhcpServer {
        constructor(config = {}) {
            this.id = config.id || 'dhcp-server-primary';
            this.name = config.name || 'Primary DHCP Server';
            this.mac = config.mac || '00:50:56:C0:00:01';
            this.ip = config.ip || '192.168.1.1';
            this.subnetMask = config.subnetMask || '255.255.255.0';
            this.gateway = config.gateway || '192.168.1.1';
            this.dns = config.dns || '8.8.8.8';
            this.domainName = config.domainName || 'local.lan';
            this.isRogue = !!config.isRogue;
            this.isEnabled = config.isEnabled !== false;

            // Address Pool Configuration
            this.poolStart = config.poolStart || '192.168.1.100';
            this.poolEnd = config.poolEnd || '192.168.1.150';
            this.defaultLeaseDuration = config.defaultLeaseDuration || 120; // seconds
            this.offerTimeoutSecs = config.offerTimeoutSecs || 15; // pending offer expiry
            this.allocationStrategy = config.allocationStrategy || 'SEQUENTIAL'; // SEQUENTIAL, RANDOM, LRU

            // Internal State Tables
            this.addressPool = new Map(); // ip -> { ip, status, clientMac, clientHost, offeredAt, leasedAt, expiresAt, xid, conflictReason }
            this.staticReservations = new Map(); // mac -> ip
            this.conflictQuarantine = new Map(); // ip -> { ip, mac, reason, quarantinedAt }
            this.activeLeaseCount = 0;

            // Statistics Counters
            this.stats = {
                discoversReceived: 0,
                offersSent: 0,
                requestsReceived: 0,
                acksSent: 0,
                naksSent: 0,
                declinesReceived: 0,
                releasesReceived: 0,
                poolExhaustionEvents: 0,
                conflictsDetected: 0
            };

            this.eventListeners = [];

            // Initialize Pool
            this.rebuildAddressPool();
        }

        onEvent(callback) {
            this.eventListeners.push(callback);
        }

        emitEvent(type, data) {
            const eventObj = {
                type,
                serverId: this.id,
                serverName: this.name,
                isRogue: this.isRogue,
                timestamp: Date.now(),
                ...data
            };
            this.eventListeners.forEach(cb => {
                try { cb(eventObj); } catch (e) { console.error('DHCP Server event error', e); }
            });
        }

        /**
         * Initializes or reconfigures the IP address pool based on start and end IPs
         */
        rebuildAddressPool() {
            const startInt = RegexValidator.ipToInt(this.poolStart);
            const endInt = RegexValidator.ipToInt(this.poolEnd);

            if (startInt === null || endInt === null || startInt > endInt) {
                console.error('Invalid IP range for DHCP pool:', this.poolStart, this.poolEnd);
                return;
            }

            const currentLeases = new Map(this.addressPool);
            this.addressPool.clear();

            for (let i = startInt; i <= endInt; i++) {
                const ipStr = RegexValidator.intToIp(i);
                const existing = currentLeases.get(ipStr);

                if (existing && (existing.status === 'BOUND' || existing.status === 'CONFLICTED')) {
                    this.addressPool.set(ipStr, existing);
                } else {
                    this.addressPool.set(ipStr, {
                        ip: ipStr,
                        intVal: i,
                        status: 'AVAILABLE', // AVAILABLE, OFFERED, BOUND, CONFLICTED, EXPIRED, STATIC
                        clientMac: null,
                        clientHost: null,
                        offeredAt: 0,
                        leasedAt: 0,
                        expiresAt: 0,
                        t1At: 0,
                        t2At: 0,
                        xid: null,
                        conflictReason: null
                    });
                }
            }

            this.updatePoolStatistics();
        }

        updatePoolStatistics() {
            let active = 0;
            let offered = 0;
            let conflicted = 0;
            let available = 0;

            for (const entry of this.addressPool.values()) {
                if (entry.status === 'BOUND') active++;
                else if (entry.status === 'OFFERED') offered++;
                else if (entry.status === 'CONFLICTED') conflicted++;
                else available++;
            }

            this.activeLeaseCount = active;
            return {
                total: this.addressPool.size,
                active,
                offered,
                conflicted,
                available,
                utilizationPercent: this.addressPool.size > 0 ? Math.round((active / this.addressPool.size) * 100) : 0
            };
        }

        getPoolEntries() {
            return Array.from(this.addressPool.values());
        }

        /**
         * Add a static IP reservation for a MAC
         */
        addStaticReservation(mac, ip) {
            const normMac = RegexValidator.normalizeMac(mac);
            if (!normMac || !RegexValidator.validateIpv4(ip)) {
                return { success: false, error: 'Invalid MAC or IP format' };
            }

            this.staticReservations.set(normMac, ip);
            if (this.addressPool.has(ip)) {
                const entry = this.addressPool.get(ip);
                entry.status = 'STATIC';
                entry.clientMac = normMac;
            }
            this.emitEvent('STATIC_RESERVATION_ADDED', { mac: normMac, ip });
            return { success: true };
        }

        removeStaticReservation(mac) {
            const normMac = RegexValidator.normalizeMac(mac);
            if (this.staticReservations.has(normMac)) {
                const ip = this.staticReservations.get(normMac);
                this.staticReservations.delete(normMac);
                if (this.addressPool.has(ip)) {
                    const entry = this.addressPool.get(ip);
                    if (entry.status === 'STATIC') {
                        entry.status = 'AVAILABLE';
                        entry.clientMac = null;
                    }
                }
                return true;
            }
            return false;
        }

        /**
         * Finds next suitable IP address according to allocation strategy
         */
        findAvailableIp(clientMac) {
            // 1. Check if MAC has a static reservation
            if (this.staticReservations.has(clientMac)) {
                const reservedIp = this.staticReservations.get(clientMac);
                const entry = this.addressPool.get(reservedIp);
                if (entry && (entry.status === 'AVAILABLE' || entry.status === 'OFFERED' || entry.status === 'STATIC' || entry.clientMac === clientMac)) {
                    return reservedIp;
                }
            }

            // 2. Check if client previously had a lease that can be restored
            for (const [ip, entry] of this.addressPool.entries()) {
                if (entry.clientMac === clientMac && (entry.status === 'AVAILABLE' || entry.status === 'EXPIRED')) {
                    return ip;
                }
            }

            // 3. Pool allocation according to strategy
            const availableIps = [];
            for (const [ip, entry] of this.addressPool.entries()) {
                if (entry.status === 'AVAILABLE' || entry.status === 'EXPIRED') {
                    // Make sure it's not reserved for another MAC
                    const reservedFor = Array.from(this.staticReservations.entries()).find(([m, resIp]) => resIp === ip);
                    if (!reservedFor || reservedFor[0] === clientMac) {
                        availableIps.push(ip);
                    }
                }
            }

            if (availableIps.length === 0) {
                return null; // Pool Exhaustion!
            }

            if (this.allocationStrategy === 'RANDOM') {
                const idx = Math.floor(Math.random() * availableIps.length);
                return availableIps[idx];
            } else if (this.allocationStrategy === 'LRU') {
                availableIps.sort((a, b) => (this.addressPool.get(a).leasedAt || 0) - (this.addressPool.get(b).leasedAt || 0));
                return availableIps[0];
            } else {
                // SEQUENTIAL (default)
                availableIps.sort((a, b) => RegexValidator.ipToInt(a) - RegexValidator.ipToInt(b));
                return availableIps[0];
            }
        }

        /**
         * Message Handler: Process DHCPDISCOVER packet
         */
        handleDiscover(packet, simTime = 0) {
            if (!this.isEnabled) return null;
            this.stats.discoversReceived++;

            const clientMac = packet.chaddr;
            const clientHost = packet.options[12] ? packet.options[12].value : packet.senderName;
            const requestedIp = packet.options[50] ? packet.options[50].value : null;

            this.emitEvent('DISCOVER_RECEIVED', {
                clientMac,
                clientHost,
                xid: packet.xid,
                requestedIp
            });

            // Find an IP to offer
            let offeredIp = null;
            if (requestedIp && this.addressPool.has(requestedIp)) {
                const entry = this.addressPool.get(requestedIp);
                if (entry.status === 'AVAILABLE' || (entry.clientMac === clientMac && entry.status !== 'CONFLICTED')) {
                    offeredIp = requestedIp;
                }
            }

            if (!offeredIp) {
                offeredIp = this.findAvailableIp(clientMac);
            }

            if (!offeredIp) {
                // POOL EXHAUSTION!
                this.stats.poolExhaustionEvents++;
                this.emitEvent('POOL_EXHAUSTION', {
                    clientMac,
                    clientHost,
                    xid: packet.xid,
                    message: `Address pool exhausted! No available IPs between ${this.poolStart} and ${this.poolEnd}`
                });
                return null; // Server remains silent or drops DISCOVER as per RFC 2131
            }

            // Reserve IP temporarily as OFFERED
            const poolEntry = this.addressPool.get(offeredIp);
            poolEntry.status = 'OFFERED';
            poolEntry.clientMac = clientMac;
            poolEntry.clientHost = clientHost;
            poolEntry.offeredAt = simTime;
            poolEntry.xid = packet.xid;

            this.stats.offersSent++;
            const offerPacket = PacketFactory.createOffer(this, packet, offeredIp, this.defaultLeaseDuration);

            this.emitEvent('OFFER_SENT', {
                clientMac,
                clientHost,
                offeredIp,
                leaseDuration: this.defaultLeaseDuration,
                xid: packet.xid
            });

            return offerPacket;
        }

        /**
         * Message Handler: Process DHCPREQUEST packet
         */
        handleRequest(packet, simTime = 0) {
            if (!this.isEnabled) return null;
            this.stats.requestsReceived++;

            const clientMac = packet.chaddr;
            const clientHost = packet.options[12] ? packet.options[12].value : packet.senderName;
            const serverIdOption = packet.options[54] ? packet.options[54].value : null;
            const requestedIp = packet.options[50] ? packet.options[50].value : packet.ciaddr;

            // If client targeted a different DHCP Server (e.g. Rogue or Secondary server race),
            // free any tentative offer this server made
            if (serverIdOption && serverIdOption !== this.ip) {
                this.releaseOfferedReservation(clientMac);
                this.emitEvent('OFFER_WITHDRAWN', {
                    clientMac,
                    selectedServer: serverIdOption,
                    reason: 'Client selected different DHCP server'
                });
                return null;
            }

            // Validate requested IP
            if (!requestedIp || !RegexValidator.validateIpv4(requestedIp)) {
                this.stats.naksSent++;
                const nakPacket = PacketFactory.createNak(this, packet, 'Malformed or missing requested IP');
                this.emitEvent('NAK_SENT', { clientMac, reason: 'Invalid IP format' });
                return nakPacket;
            }

            // Check if requested IP belongs to this subnet
            if (!RegexValidator.isIpInSubnet(requestedIp, this.ip, this.subnetMask)) {
                this.stats.naksSent++;
                const nakPacket = PacketFactory.createNak(this, packet, `Requested IP ${requestedIp} is not in server subnet`);
                this.emitEvent('NAK_SENT', { clientMac, requestedIp, reason: 'Subnet mismatch' });
                return nakPacket;
            }

            const poolEntry = this.addressPool.get(requestedIp);

            // If IP does not exist in pool or is already leased to ANOTHER client
            if (!poolEntry || (poolEntry.status === 'BOUND' && poolEntry.clientMac !== clientMac)) {
                this.stats.naksSent++;
                const nakPacket = PacketFactory.createNak(this, packet, `IP ${requestedIp} is already leased or unavailable`);
                this.emitEvent('NAK_SENT', { clientMac, requestedIp, reason: 'Address already leased to another client' });
                return nakPacket;
            }

            // If IP is quarantined due to conflict
            if (poolEntry.status === 'CONFLICTED') {
                this.stats.naksSent++;
                const nakPacket = PacketFactory.createNak(this, packet, `IP ${requestedIp} is quarantined due to address collision`);
                this.emitEvent('NAK_SENT', { clientMac, requestedIp, reason: 'Address marked conflicted' });
                return nakPacket;
            }

            // Commit the Lease!
            const leaseSecs = this.defaultLeaseDuration;
            poolEntry.status = 'BOUND';
            poolEntry.clientMac = clientMac;
            poolEntry.clientHost = clientHost;
            poolEntry.leasedAt = simTime;
            poolEntry.expiresAt = simTime + leaseSecs;
            poolEntry.t1At = simTime + Math.floor(leaseSecs * 0.5);
            poolEntry.t2At = simTime + Math.floor(leaseSecs * 0.875);
            poolEntry.xid = packet.xid;

            this.stats.acksSent++;
            const ackPacket = PacketFactory.createAck(this, packet, leaseSecs);

            this.emitEvent('ACK_SENT', {
                clientMac,
                clientHost,
                leasedIp: requestedIp,
                leaseSecs,
                expiresAt: poolEntry.expiresAt,
                t1At: poolEntry.t1At,
                t2At: poolEntry.t2At,
                xid: packet.xid
            });

            this.updatePoolStatistics();
            return ackPacket;
        }

        /**
         * Message Handler: Process DHCPDECLINE packet (Address Conflict)
         */
        handleDecline(packet, simTime = 0) {
            this.stats.declinesReceived++;
            this.stats.conflictsDetected++;

            const declinedIp = packet.options[50] ? packet.options[50].value : packet.ciaddr;
            const reason = packet.options[56] ? packet.options[56].value : 'ARP collision detected by client';

            if (declinedIp && this.addressPool.has(declinedIp)) {
                const entry = this.addressPool.get(declinedIp);
                entry.status = 'CONFLICTED';
                entry.conflictReason = reason;
                entry.quarantinedAt = simTime;

                this.conflictQuarantine.set(declinedIp, {
                    ip: declinedIp,
                    mac: packet.chaddr,
                    reason,
                    quarantinedAt: simTime
                });

                this.emitEvent('DECLINE_RECEIVED', {
                    declinedIp,
                    clientMac: packet.chaddr,
                    reason,
                    quarantined: true
                });

                this.updatePoolStatistics();
            }
        }

        /**
         * Message Handler: Process DHCPRELEASE packet (Graceful Lease Surrender)
         */
        handleRelease(packet, simTime = 0) {
            this.stats.releasesReceived++;

            const releasingIp = packet.ciaddr;
            const clientMac = packet.chaddr;

            if (releasingIp && this.addressPool.has(releasingIp)) {
                const entry = this.addressPool.get(releasingIp);
                if (entry.clientMac === clientMac) {
                    entry.status = 'AVAILABLE';
                    entry.clientMac = null;
                    entry.clientHost = null;
                    entry.leasedAt = 0;
                    entry.expiresAt = 0;

                    this.emitEvent('RELEASE_RECEIVED', {
                        releasingIp,
                        clientMac,
                        status: 'Returned to available pool'
                    });

                    this.updatePoolStatistics();
                }
            }
        }

        /**
         * Withdraws any temporary offer held by a MAC
         */
        releaseOfferedReservation(clientMac) {
            for (const entry of this.addressPool.values()) {
                if (entry.clientMac === clientMac && entry.status === 'OFFERED') {
                    entry.status = 'AVAILABLE';
                    entry.clientMac = null;
                    entry.clientHost = null;
                }
            }
        }

        /**
         * Simulation Tick: Garbage collection of expired leases & stale offers
         */
        tick(simTime) {
            let changed = false;

            for (const entry of this.addressPool.values()) {
                // Check if leased IP has expired
                if (entry.status === 'BOUND' && simTime >= entry.expiresAt) {
                    entry.status = 'EXPIRED';
                    this.emitEvent('LEASE_EXPIRED_SERVER', {
                        ip: entry.ip,
                        clientMac: entry.clientMac,
                        clientHost: entry.clientHost,
                        expiredAt: simTime
                    });
                    // Reclaim back to available
                    entry.status = 'AVAILABLE';
                    entry.clientMac = null;
                    entry.clientHost = null;
                    changed = true;
                }

                // Check stale offered reservation timeout
                if (entry.status === 'OFFERED' && (simTime - entry.offeredAt) > this.offerTimeoutSecs) {
                    entry.status = 'AVAILABLE';
                    entry.clientMac = null;
                    entry.clientHost = null;
                    changed = true;
                }
            }

            if (changed) {
                this.updatePoolStatistics();
            }
        }

        /**
         * Clear an IP from quarantine
         */
        clearQuarantine(ip) {
            if (this.addressPool.has(ip)) {
                const entry = this.addressPool.get(ip);
                if (entry.status === 'CONFLICTED') {
                    entry.status = 'AVAILABLE';
                    entry.conflictReason = null;
                    this.conflictQuarantine.delete(ip);
                    this.emitEvent('QUARANTINE_CLEARED', { ip });
                    this.updatePoolStatistics();
                    return true;
                }
            }
            return false;
        }

        /**
         * Inject a manual conflict on an IP
         */
        injectConflict(ip, reason = 'Manual Administrator Conflict Injection') {
            if (this.addressPool.has(ip)) {
                const entry = this.addressPool.get(ip);
                entry.status = 'CONFLICTED';
                entry.conflictReason = reason;
                this.conflictQuarantine.set(ip, { ip, reason, quarantinedAt: Date.now() });
                this.emitEvent('CONFLICT_INJECTED', { ip, reason });
                this.updatePoolStatistics();
                return true;
            }
            return false;
        }
    }

    return DhcpServer;
}));

/**
 * Network Address Allocation and DHCP Lease Simulation System
 * DHCP Client Device Model
 * 
 * Simulates a client device running the DHCP finite-state machine,
 * network configuration, lease timers (T1, T2, T3), ARP probe conflict detection,
 * and message handling.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./regex-validator', './packet', './fsm'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./regex-validator'), require('./packet'), require('./fsm'));
    } else {
        root.DhcpClient = factory(root.RegexValidator, root.DhcpPacket, root.DhcpFSM);
    }
}(typeof self !== 'undefined' ? self : this, function (RegexValidator, DhcpPacket, DhcpFSM) {

    const { PacketFactory } = DhcpPacket;
    const { FiniteStateMachine } = DhcpFSM;

    let clientSequence = 1;

    class DhcpClient {
        constructor(config = {}) {
            this.id = config.id || ('client-' + clientSequence++);
            this.hostname = config.hostname || (`Host-${clientSequence}`);
            this.mac = RegexValidator.normalizeMac(config.mac || this.generateRandomMac());
            this.deviceType = config.deviceType || 'laptop'; // laptop, phone, workstation, iot, server, rogue
            this.isRogue = !!config.isRogue;

            // Network Stack Configuration (active when BOUND)
            this.ip = '0.0.0.0';
            this.subnetMask = '0.0.0.0';
            this.gateway = '0.0.0.0';
            this.dns = '0.0.0.0';
            this.leasingServerIp = null;
            this.leasingServerMac = null;

            // Lease Timing Data
            this.leaseDuration = 0;
            this.leaseStartTime = 0;
            this.leaseExpiresAt = 0;
            this.t1Time = 0;
            this.t2Time = 0;

            // Active Protocol State
            this.currentXid = null;
            this.lastOfferPacket = null;
            this.retransmitCount = 0;
            this.backoffDelay = 0;

            // Fault Injection & Simulation Flags
            this.simulateConflictOnAck = !!config.simulateConflictOnAck;
            this.ignoreT1Renewal = !!config.ignoreT1Renewal; // Used to demonstrate transition to T2 Rebinding
            this.requestSpecificIp = config.requestSpecificIp || null;

            // Event Callbacks
            this.eventListeners = [];

            // Initialize Finite-State Machine
            this.fsm = new FiniteStateMachine(this.id, 'INIT', (cId, from, to, record) => {
                this.emitEvent('STATE_CHANGED', { from, to, record });
            });
        }

        generateRandomMac() {
            const hex = '0123456789ABCDEF';
            let mac = '02'; // Local unicast (LSB of first byte is 0, second bit is 1)
            for (let i = 0; i < 5; i++) {
                mac += ':' + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
            }
            return mac;
        }

        onEvent(callback) {
            this.eventListeners.push(callback);
        }

        emitEvent(type, data) {
            const eventObj = {
                type,
                clientId: this.id,
                hostname: this.hostname,
                mac: this.mac,
                currentState: this.fsm.getState(),
                timestamp: Date.now(),
                ...data
            };
            this.eventListeners.forEach(cb => {
                try { cb(eventObj); } catch (e) { console.error('DHCP Client event error', e); }
            });
        }

        getState() {
            return this.fsm.getState();
        }

        getStateMeta() {
            return this.fsm.getStateMeta();
        }

        isBound() {
            return this.fsm.isBound() && this.ip !== '0.0.0.0';
        }

        /**
         * Calculate remaining lease metrics
         */
        getLeaseMetrics(simTime) {
            if (!this.isBound() || this.leaseExpiresAt === 0) {
                return {
                    active: false,
                    totalDuration: 0,
                    remainingSecs: 0,
                    progressPercent: 0,
                    isPastT1: false,
                    isPastT2: false
                };
            }

            const remainingSecs = Math.max(0, this.leaseExpiresAt - simTime);
            const elapsed = simTime - this.leaseStartTime;
            const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / this.leaseDuration) * 100)));

            return {
                active: true,
                totalDuration: this.leaseDuration,
                remainingSecs,
                elapsedSecs: elapsed,
                progressPercent,
                isPastT1: simTime >= this.t1Time,
                isPastT2: simTime >= this.t2Time
            };
        }

        /**
         * Step 1: Client initiates DHCP acquisition (DHCPDISCOVER)
         */
        startAcquisition(simTime = 0) {
            if (this.getState() !== 'INIT' && this.getState() !== 'RELEASED' && this.getState() !== 'EXPIRED' && this.getState() !== 'DECLINED') {
                console.warn(`Client ${this.hostname} is already in state ${this.getState()}`);
            }

            this.fsm.transition('SELECTING', 'SEND_DISCOVER', 'Broadcasting DHCPDISCOVER to find DHCP servers', simTime);

            const discoverPacket = PacketFactory.createDiscover(this, {
                requestedIp: this.requestSpecificIp
            });
            this.currentXid = discoverPacket.xid;

            this.emitEvent('DISCOVER_SENT', {
                xid: this.currentXid,
                requestedIp: this.requestSpecificIp
            });

            return discoverPacket;
        }

        /**
         * Step 2: Client evaluates DHCPOFFER and sends DHCPREQUEST
         */
        handleOffer(offerPacket, simTime = 0) {
            if (this.getState() !== 'SELECTING') {
                return null; // Ignore offers if not in selecting state
            }

            // Verify transaction ID
            if (offerPacket.xid !== this.currentXid) {
                return null;
            }

            this.lastOfferPacket = offerPacket;
            const offeredIp = offerPacket.yiaddr;
            const serverId = offerPacket.options[54] ? offerPacket.options[54].value : offerPacket.srcIp;

            this.fsm.transition('REQUESTING', 'RECEIVE_OFFER', `Accepted offer of ${offeredIp} from ${serverId}`, simTime);

            // Create DHCPREQUEST
            const requestPacket = PacketFactory.createRequest(this, offerPacket);

            this.emitEvent('REQUEST_SENT', {
                xid: this.currentXid,
                requestedIp: offeredIp,
                serverId
            });

            return requestPacket;
        }

        /**
         * Step 3: Client handles DHCPACK
         */
        handleAck(ackPacket, simTime = 0) {
            const currentState = this.getState();
            if (currentState !== 'REQUESTING' && currentState !== 'RENEWING' && currentState !== 'REBINDING') {
                return null;
            }

            // Check if simulated conflict was requested
            if (this.simulateConflictOnAck) {
                this.simulateConflictOnAck = false; // Reset trigger
                return this.triggerConflictDecline(ackPacket.yiaddr || this.ip, ackPacket.srcIp, simTime);
            }

            // Configure network interface with offered parameters
            this.ip = ackPacket.yiaddr || this.ip;
            this.subnetMask = ackPacket.options[1] ? ackPacket.options[1].value : '255.255.255.0';
            this.gateway = ackPacket.options[3] ? ackPacket.options[3].value : '192.168.1.1';
            this.dns = ackPacket.options[6] ? ackPacket.options[6].value : '8.8.8.8';
            this.leasingServerIp = ackPacket.options[54] ? ackPacket.options[54].value : ackPacket.srcIp;
            this.leasingServerMac = ackPacket.srcMac;

            // Compute lease timings
            this.leaseDuration = ackPacket.options[51] ? parseInt(ackPacket.options[51].value, 10) : 120;
            this.leaseStartTime = simTime;
            this.leaseExpiresAt = simTime + this.leaseDuration;
            this.t1Time = ackPacket.options[58] ? simTime + parseInt(ackPacket.options[58].value, 10) : simTime + Math.floor(this.leaseDuration * 0.5);
            this.t2Time = ackPacket.options[59] ? simTime + parseInt(ackPacket.options[59].value, 10) : simTime + Math.floor(this.leaseDuration * 0.875);

            const transitionEvent = currentState === 'RENEWING' ? 'RENEW_ACK_RECEIVED' :
                                    currentState === 'REBINDING' ? 'REBIND_ACK_RECEIVED' : 'RECEIVE_ACK';

            this.fsm.transition('BOUND', transitionEvent, `Lease committed for ${this.ip} (${this.leaseDuration}s)`, simTime);

            this.emitEvent('BOUND_SUCCESS', {
                ip: this.ip,
                subnetMask: this.subnetMask,
                gateway: this.gateway,
                dns: this.dns,
                leasingServerIp: this.leasingServerIp,
                leaseDuration: this.leaseDuration,
                expiresAt: this.leaseExpiresAt
            });

            return null;
        }

        /**
         * Handle DHCPNAK (Rejection)
         */
        handleNak(nakPacket, simTime = 0) {
            const reason = nakPacket.options[56] ? nakPacket.options[56].value : 'Server rejected lease request';

            this.ip = '0.0.0.0';
            this.leaseDuration = 0;
            this.fsm.transition('INIT', 'RECEIVE_NAK', `Received DHCPNAK: ${reason}`, simTime);

            this.emitEvent('NAK_RECEIVED', {
                reason,
                serverId: nakPacket.srcIp
            });

            return null;
        }

        /**
         * Trigger ARP Probe Conflict & DHCPDECLINE
         */
        triggerConflictDecline(conflictedIp, serverIp, simTime = 0) {
            this.fsm.transition('DECLINED', 'CONFLICT_DETECTED', `Address collision detected for ${conflictedIp} via ARP probe!`, simTime);

            const declinePacket = PacketFactory.createDecline(this, conflictedIp, serverIp);
            this.ip = '0.0.0.0';

            this.emitEvent('CONFLICT_DECLINED', {
                conflictedIp,
                serverIp,
                reason: 'Gratuitous ARP reply received from duplicate host'
            });

            return declinePacket;
        }

        /**
         * Step 4: Graceful Release (DHCPRELEASE)
         */
        releaseLease(simTime = 0) {
            if (!this.isBound()) return null;

            const oldIp = this.ip;
            const serverIp = this.leasingServerIp;

            const releasePacket = PacketFactory.createRelease(this, serverIp);

            this.fsm.transition('RELEASED', 'SEND_RELEASE', `Gracefully released IP ${oldIp}`, simTime);
            this.ip = '0.0.0.0';
            this.leaseDuration = 0;
            this.leaseExpiresAt = 0;

            this.emitEvent('LEASE_RELEASED', { oldIp, serverIp });

            // Return to INIT after brief period
            setTimeout(() => {
                if (this.fsm.getState() === 'RELEASED') {
                    this.fsm.transition('INIT', 'RESET', 'Ready for new discovery cycle', simTime);
                }
            }, 500);

            return releasePacket;
        }

        /**
         * Force manual T1 Renewal
         */
        renewLease(simTime = 0) {
            if (!this.isBound()) return null;

            this.fsm.transition('RENEWING', 'TIMER_T1_EXPIRED', `Unicasting renewal DHCPREQUEST to ${this.leasingServerIp}`, simTime);

            const renewPacket = PacketFactory.createRequest(this, {
                srcMac: this.leasingServerMac,
                srcIp: this.leasingServerIp,
                yiaddr: this.ip,
                xid: this.currentXid || DhcpPacket.generateXid(),
                options: { 54: { value: this.leasingServerIp } }
            }, true, false);

            this.emitEvent('RENEW_REQUEST_SENT', { ip: this.ip, serverIp: this.leasingServerIp });
            return renewPacket;
        }

        /**
         * Force manual Rebinding
         */
        rebindLease(simTime = 0) {
            if (this.getState() !== 'BOUND' && this.getState() !== 'RENEWING') return null;

            this.fsm.transition('REBINDING', 'TIMER_T2_EXPIRED', `Broadcasting rebinding DHCPREQUEST to all servers`, simTime);

            const rebindPacket = PacketFactory.createRequest(this, {
                srcMac: 'FF:FF:FF:FF:FF:FF',
                srcIp: '255.255.255.255',
                yiaddr: this.ip,
                xid: this.currentXid || DhcpPacket.generateXid(),
                options: {}
            }, true, true);

            this.emitEvent('REBIND_REQUEST_SENT', { ip: this.ip });
            return rebindPacket;
        }

        /**
         * Force immediate lease expiration
         */
        forceExpire(simTime = 0) {
            if (!this.isBound()) return;

            const oldIp = this.ip;
            this.fsm.transition('EXPIRED', 'LEASE_EXPIRED', `Lease for ${oldIp} expired`, simTime);
            this.ip = '0.0.0.0';
            this.leaseDuration = 0;
            this.leaseExpiresAt = 0;

            this.emitEvent('LEASE_EXPIRED_CLIENT', { oldIp });

            setTimeout(() => {
                if (this.fsm.getState() === 'EXPIRED') {
                    this.fsm.transition('INIT', 'RESET', 'Returning to unconfigured state', simTime);
                }
            }, 600);
        }

        /**
         * Simulation Tick: Monitors T1, T2, and T3 timers
         */
        tick(simTime) {
            const state = this.getState();

            // 1. In BOUND state: check if T1 timer reached
            if (state === 'BOUND') {
                if (simTime >= this.t1Time) {
                    if (this.ignoreT1Renewal) {
                        // Demo mode: skip renewal to demonstrate T2 rebinding
                        console.log(`[Demo] Client ${this.hostname} skipping T1 renewal to test T2 rebinding`);
                    } else {
                        return this.renewLease(simTime);
                    }
                }
            }

            // 2. In RENEWING (or BOUND if T1 skipped): check if T2 timer reached
            if (state === 'RENEWING' || (state === 'BOUND' && simTime >= this.t2Time)) {
                if (simTime >= this.t2Time) {
                    return this.rebindLease(simTime);
                }
            }

            // 3. In RENEWING or REBINDING: check if T3 (Lease Expiry) reached
            if (state === 'BOUND' || state === 'RENEWING' || state === 'REBINDING') {
                if (simTime >= this.leaseExpiresAt) {
                    this.forceExpire(simTime);
                }
            }

            return null;
        }
    }

    return DhcpClient;
}));

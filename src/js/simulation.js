/**
 * Network Address Allocation and DHCP Lease Simulation System
 * Core Simulation Coordinator Engine
 * 
 * Orchestrates virtual network topology, clock ticks, packet dispatching,
 * message sequence logging, fault injections, and scenario execution.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./regex-validator', './packet', './fsm', './dhcp-server', './client'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('./regex-validator'),
            require('./packet'),
            require('./fsm'),
            require('./dhcp-server'),
            require('./client')
        );
    } else {
        root.DhcpSimulation = factory(
            root.RegexValidator,
            root.DhcpPacket,
            root.DhcpFSM,
            root.DhcpServer,
            root.DhcpClient
        );
    }
}(typeof self !== 'undefined' ? self : this, function (RegexValidator, DhcpPacket, DhcpFSM, DhcpServer, DhcpClient) {

    const { Packet, PacketFactory } = DhcpPacket;

    class SimulationCoordinator {
        constructor(config = {}) {
            // Virtual Clock & Running State
            this.simTime = 0; // Simulation time in seconds
            this.simSpeed = 1; // 1x, 2x, 5x, 10x, etc.
            this.isRunning = false;
            this.timerInterval = null;
            this.tickRateMs = 1000; // 1 real second per sim tick at 1x

            // Network Topology
            this.server = new DhcpServer({
                id: 'dhcp-server-01',
                name: 'Core DHCP Server',
                ip: '192.168.1.1',
                mac: '00:1A:4A:10:20:01',
                subnetMask: '255.255.255.0',
                gateway: '192.168.1.1',
                dns: '8.8.8.8',
                poolStart: '192.168.1.100',
                poolEnd: '192.168.1.130',
                defaultLeaseDuration: 120 // 2 minutes for interactive testing
            });

            this.rogueServer = new DhcpServer({
                id: 'dhcp-rogue-01',
                name: 'Rogue DHCP Server',
                ip: '10.0.0.1',
                mac: 'DE:AD:BE:EF:00:01',
                subnetMask: '255.255.0.0',
                gateway: '10.0.0.1',
                dns: '1.1.1.1',
                poolStart: '10.0.0.50',
                poolEnd: '10.0.0.99',
                defaultLeaseDuration: 60,
                isRogue: true,
                isEnabled: false // Disabled by default
            });

            this.clients = new Map(); // id -> DhcpClient
            this.packetHistory = []; // All transmitted packets for inspector & sequence diagram
            this.eventLog = []; // System log messages
            this.inFlightPackets = []; // Packets currently animating in transit

            // Simulation options
            this.packetDropRate = 0; // 0 to 1
            this.packetLatencySecs = 0.4; // visual delay for animations

            // Event Listeners
            this.listeners = [];

            // Wire up server events to system logger
            this.bindServerEvents(this.server);
            this.bindServerEvents(this.rogueServer);

            // Populate initial default clients
            this.initDefaultDevices();
        }

        bindServerEvents(server) {
            server.onEvent(evt => {
                let level = 'INFO';
                if (evt.type === 'ACK_SENT') level = 'SUCCESS';
                else if (evt.type === 'NAK_SENT' || evt.type === 'DECLINE_RECEIVED') level = 'ERROR';
                else if (evt.type === 'POOL_EXHAUSTION' || evt.type === 'LEASE_EXPIRED_SERVER') level = 'WARN';

                this.logEvent(level, `[${server.name}] ${evt.type}`, evt);
            });
        }

        addListener(callback) {
            this.listeners.push(callback);
        }

        emit(eventType, payload) {
            const data = {
                type: eventType,
                simTime: this.simTime,
                timestamp: Date.now(),
                ...payload
            };
            this.listeners.forEach(cb => {
                try { cb(data); } catch (e) { console.error('Sim coordinator event error', e); }
            });
        }

        logEvent(level, title, details = {}) {
            const entry = {
                id: 'log-' + (this.eventLog.length + 1),
                simTime: this.simTime,
                timestamp: new Date().toLocaleTimeString(),
                level, // INFO, SUCCESS, WARN, ERROR, PACKET, CONFLICT
                title,
                details
            };
            this.eventLog.unshift(entry);
            if (this.eventLog.length > 500) this.eventLog.pop();
            this.emit('LOG_ENTRY', { entry });
        }

        /**
         * Setup initial demo devices
         */
        initDefaultDevices() {
            this.addClient({
                id: 'client-laptop-1',
                hostname: 'Laptop-Alpha',
                mac: '00:1E:67:98:2A:1B',
                deviceType: 'laptop'
            });

            this.addClient({
                id: 'client-phone-2',
                hostname: 'iPhone-15',
                mac: 'F0:18:98:4C:55:02',
                deviceType: 'phone'
            });

            this.addClient({
                id: 'client-workstation-3',
                hostname: 'Workstation-Pro',
                mac: '3C:D9:2B:11:80:A3',
                deviceType: 'workstation'
            });

            this.addClient({
                id: 'client-iot-4',
                hostname: 'IoT-SmartSensor',
                mac: 'B8:27:EB:44:9C:F4',
                deviceType: 'iot'
            });
        }

        /**
         * Add a new client device with strict regex validation
         */
        addClient(clientConfig) {
            // Regex Validate MAC
            const macValidation = RegexValidator.verifyMacAddress(clientConfig.mac);
            if (!macValidation.valid) {
                this.logEvent('ERROR', `Failed to add device: ${macValidation.error}`);
                return { success: false, error: macValidation.error };
            }

            // Regex Validate Hostname
            if (!RegexValidator.validateHostname(clientConfig.hostname)) {
                const err = `Invalid hostname '${clientConfig.hostname}'. Must comply with RFC 1123 (alphanumeric, hyphens allowed).`;
                this.logEvent('ERROR', err);
                return { success: false, error: err };
            }

            // Check duplicate MAC
            const normalizedMac = macValidation.normalized;
            for (const existing of this.clients.values()) {
                if (existing.mac === normalizedMac) {
                    const err = `Device with MAC ${normalizedMac} already exists (${existing.hostname})`;
                    this.logEvent('ERROR', err);
                    return { success: false, error: err };
                }
            }

            const client = new DhcpClient({
                ...clientConfig,
                mac: normalizedMac
            });

            client.onEvent(evt => {
                let level = 'INFO';
                if (evt.type === 'BOUND_SUCCESS') level = 'SUCCESS';
                else if (evt.type === 'CONFLICT_DECLINED' || evt.type === 'NAK_RECEIVED') level = 'ERROR';
                else if (evt.type === 'LEASE_EXPIRED_CLIENT') level = 'WARN';

                this.logEvent(level, `[${client.hostname}] ${evt.type}`, evt);
                this.emit('CLIENT_UPDATED', { client });
            });

            this.clients.set(client.id, client);
            this.logEvent('INFO', `New device connected: ${client.hostname} (${client.mac})`);
            this.emit('CLIENT_ADDED', { client });
            return { success: true, client };
        }

        removeClient(clientId) {
            const client = this.clients.get(clientId);
            if (client) {
                if (client.isBound()) {
                    this.triggerRelease(clientId);
                }
                this.clients.delete(clientId);
                this.logEvent('INFO', `Device removed: ${client.hostname}`);
                this.emit('CLIENT_REMOVED', { clientId });
                return true;
            }
            return false;
        }

        getClient(clientId) {
            return this.clients.get(clientId);
        }

        getAllClients() {
            return Array.from(this.clients.values());
        }

        /**
         * Packet Transmission Pipeline
         */
        transmitPacket(packet, onDelivered = null) {
            packet.simTick = this.simTime;
            this.packetHistory.unshift(packet);
            if (this.packetHistory.length > 300) this.packetHistory.pop();

            this.logEvent('PACKET', `[PACKET] ${packet.getTypeName()} (${packet.senderName} -> ${packet.targetName})`, {
                xid: packet.xid,
                src: `${packet.srcIp} (${packet.srcMac})`,
                dst: `${packet.dstIp} (${packet.dstMac})`,
                summary: packet.getSummary(),
                packetId: packet.id
            });

            this.emit('PACKET_DISPATCHED', { packet });

            // Simulate Network Wire Delivery Latency
            const delayMs = Math.max(100, Math.floor((this.packetLatencySecs * 1000) / this.simSpeed));

            setTimeout(() => {
                this.deliverPacket(packet);
                if (typeof onDelivered === 'function') {
                    onDelivered(packet);
                }
            }, delayMs);
        }

        /**
         * Packet Delivery Dispatcher
         */
        deliverPacket(packet) {
            packet.status = 'delivered';
            this.emit('PACKET_DELIVERED', { packet });

            // 1. Packets from Client to Server
            if (packet.senderRole === 'Client') {
                if (packet.messageType === 1) { // DHCPDISCOVER
                    // Deliver to Primary DHCP Server
                    const offer1 = this.server.handleDiscover(packet, this.simTime);
                    if (offer1) {
                        this.transmitPacket(offer1);
                    }

                    // If Rogue Server is active, deliver to Rogue Server too (racing condition!)
                    if (this.rogueServer.isEnabled) {
                        setTimeout(() => {
                            const offer2 = this.rogueServer.handleDiscover(packet, this.simTime);
                            if (offer2) {
                                this.transmitPacket(offer2);
                            }
                        }, 50);
                    }
                } else if (packet.messageType === 3) { // DHCPREQUEST
                    const resp1 = this.server.handleRequest(packet, this.simTime);
                    if (resp1) {
                        this.transmitPacket(resp1);
                    }

                    if (this.rogueServer.isEnabled) {
                        const resp2 = this.rogueServer.handleRequest(packet, this.simTime);
                        if (resp2) {
                            this.transmitPacket(resp2);
                        }
                    }
                } else if (packet.messageType === 4) { // DHCPDECLINE
                    this.server.handleDecline(packet, this.simTime);
                    if (this.rogueServer.isEnabled) {
                        this.rogueServer.handleDecline(packet, this.simTime);
                    }
                } else if (packet.messageType === 7) { // DHCPRELEASE
                    this.server.handleRelease(packet, this.simTime);
                    if (this.rogueServer.isEnabled) {
                        this.rogueServer.handleRelease(packet, this.simTime);
                    }
                }
            }
            // 2. Packets from Server to Client
            else if (packet.senderRole === 'Server' || packet.senderRole === 'RogueServer') {
                const targetClient = Array.from(this.clients.values()).find(c => c.mac === packet.chaddr);
                if (targetClient) {
                    if (packet.messageType === 2) { // DHCPOFFER
                        const reqPacket = targetClient.handleOffer(packet, this.simTime);
                        if (reqPacket) {
                            this.transmitPacket(reqPacket);
                        }
                    } else if (packet.messageType === 5) { // DHCPACK
                        const declinePacket = targetClient.handleAck(packet, this.simTime);
                        if (declinePacket) {
                            // If conflict detected, client emits DHCPDECLINE
                            this.transmitPacket(declinePacket);
                        }
                    } else if (packet.messageType === 6) { // DHCPNAK
                        targetClient.handleNak(packet, this.simTime);
                    }
                }
            }
        }

        /**
         * Trigger DORA acquisition for a client
         */
        triggerAcquire(clientId) {
            const client = this.clients.get(clientId);
            if (!client) return;

            const discoverPacket = client.startAcquisition(this.simTime);
            if (discoverPacket) {
                this.transmitPacket(discoverPacket);
            }
        }

        /**
         * Trigger renewal for a client
         */
        triggerRenew(clientId) {
            const client = this.clients.get(clientId);
            if (!client || !client.isBound()) return;

            const renewPacket = client.renewLease(this.simTime);
            if (renewPacket) {
                this.transmitPacket(renewPacket);
            }
        }

        /**
         * Trigger release for a client
         */
        triggerRelease(clientId) {
            const client = this.clients.get(clientId);
            if (!client || !client.isBound()) return;

            const releasePacket = client.releaseLease(this.simTime);
            if (releasePacket) {
                this.transmitPacket(releasePacket);
            }
        }

        /**
         * Trigger conflict scenario for a client
         */
        triggerClientConflict(clientId) {
            const client = this.clients.get(clientId);
            if (!client) return;

            client.simulateConflictOnAck = true;
            this.logEvent('WARN', `Configured ${client.hostname} to simulate ARP conflict upon ACK`);
            
            if (client.getState() === 'INIT') {
                this.triggerAcquire(clientId);
            } else if (client.isBound()) {
                // If already bound, trigger late collision
                const confIp = client.ip;
                const serverIp = client.leasingServerIp;
                const decline = client.triggerConflictDecline(confIp, serverIp, this.simTime);
                if (decline) {
                    this.transmitPacket(decline);
                }
            }
        }

        /**
         * Start Simulation Clock
         */
        start() {
            if (this.isRunning) return;
            this.isRunning = true;
            this.logEvent('INFO', `Simulation started at speed ${this.simSpeed}x`);

            const tickIntervalMs = Math.max(50, Math.floor(1000 / this.simSpeed));
            this.timerInterval = setInterval(() => {
                this.tick();
            }, tickIntervalMs);

            this.emit('SIM_STARTED');
        }

        /**
         * Pause Simulation Clock
         */
        pause() {
            if (!this.isRunning) return;
            this.isRunning = false;
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            this.logEvent('INFO', 'Simulation paused');
            this.emit('SIM_PAUSED');
        }

        /**
         * Set Simulation Speed
         */
        setSpeed(multiplier) {
            this.simSpeed = Math.max(0.2, Math.min(60, multiplier));
            if (this.isRunning) {
                this.pause();
                this.start();
            }
            this.emit('SPEED_CHANGED', { speed: this.simSpeed });
        }

        /**
         * Execute one simulation tick
         */
        tick() {
            this.simTime += 1;

            // Tick Server (Lease expiry, offer timeouts)
            this.server.tick(this.simTime);
            if (this.rogueServer.isEnabled) {
                this.rogueServer.tick(this.simTime);
            }

            // Tick Clients (T1, T2, T3 timers)
            for (const client of this.clients.values()) {
                const autoPacket = client.tick(this.simTime);
                if (autoPacket) {
                    this.transmitPacket(autoPacket);
                }
            }

            this.emit('SIM_TICK', { simTime: this.simTime });
        }

        /**
         * Step single tick forward (manual stepping)
         */
        step() {
            this.pause();
            this.tick();
        }

        /**
         * Reset simulation to initial state
         */
        reset() {
            this.pause();
            this.simTime = 0;
            this.packetHistory = [];
            this.eventLog = [];

            // Reset Server
            this.server.rebuildAddressPool();
            this.rogueServer.rebuildAddressPool();
            this.rogueServer.isEnabled = false;

            // Reset Clients
            for (const client of this.clients.values()) {
                client.ip = '0.0.0.0';
                client.leaseDuration = 0;
                client.leaseExpiresAt = 0;
                client.fsm.reset(0);
            }

            this.logEvent('INFO', 'Simulation reset to factory state');
            this.emit('SIM_RESET');
        }

        /**
         * Run Pre-configured Scenarios
         */
        runScenario(scenarioId) {
            this.reset();
            this.start();

            if (scenarioId === 'dora-happy-path') {
                this.logEvent('INFO', '=== Scenario: Standard 4-Step DORA Handshake ===');
                const client = Array.from(this.clients.values())[0];
                setTimeout(() => {
                    this.triggerAcquire(client.id);
                }, 400);
            } else if (scenarioId === 'address-conflict') {
                this.logEvent('WARN', '=== Scenario: Address Conflict & ARP Decline ===');
                const client = Array.from(this.clients.values())[0];
                client.simulateConflictOnAck = true;
                setTimeout(() => {
                    this.triggerAcquire(client.id);
                }, 400);
            } else if (scenarioId === 'pool-exhaustion') {
                this.logEvent('WARN', '=== Scenario: Address Pool Exhaustion ===');
                // Shrink server pool to 2 addresses
                this.server.poolStart = '192.168.1.100';
                this.server.poolEnd = '192.168.1.101';
                this.server.rebuildAddressPool();

                // Connect 4 clients rapidly
                const allClients = Array.from(this.clients.values());
                allClients.forEach((c, idx) => {
                    setTimeout(() => {
                        this.triggerAcquire(c.id);
                    }, 300 + idx * 400);
                });
            } else if (scenarioId === 'lease-expiry-reclaim') {
                this.logEvent('INFO', '=== Scenario: Short Lease Expiration & Reclaiming ===');
                this.server.defaultLeaseDuration = 20; // 20 seconds short lease
                this.setSpeed(2);
                const client = Array.from(this.clients.values())[0];
                client.ignoreT1Renewal = true; // Skip renewal to watch it expire
                setTimeout(() => {
                    this.triggerAcquire(client.id);
                }, 400);
            } else if (scenarioId === 'mid-lease-renewal') {
                this.logEvent('INFO', '=== Scenario: Mid-Lease T1 Renewal Success ===');
                this.server.defaultLeaseDuration = 30; // 30s
                this.setSpeed(2);
                const client = Array.from(this.clients.values())[0];
                setTimeout(() => {
                    this.triggerAcquire(client.id);
                }, 400);
            } else if (scenarioId === 'rogue-server-race') {
                this.logEvent('WARN', '=== Scenario: Rogue DHCP Server Race Condition ===');
                this.rogueServer.isEnabled = true;
                const client = Array.from(this.clients.values())[0];
                setTimeout(() => {
                    this.triggerAcquire(client.id);
                }, 400);
            } else if (scenarioId === 'stress-multi-device') {
                this.logEvent('INFO', '=== Scenario: Multi-Device Bulk Handshake ===');
                const allClients = Array.from(this.clients.values());
                allClients.forEach((c, idx) => {
                    setTimeout(() => {
                        this.triggerAcquire(c.id);
                    }, idx * 500);
                });
            }
        }
    }

    return SimulationCoordinator;
}));

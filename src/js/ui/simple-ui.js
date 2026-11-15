/**
 * Network Address Allocation and DHCP Lease Simulation System
 * Master UI Controller with Teacher Presentation Assistant & Auto-Syncing Regex Validator
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['../regex-validator', '../packet', '../fsm', '../simulation'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../regex-validator'),
            require('../packet'),
            require('../fsm'),
            require('../simulation')
        );
    } else {
        root.SimpleUI = factory(
            root.RegexValidator,
            root.DhcpPacket,
            root.DhcpFSM,
            root.DhcpSimulation
        );
    }
}(typeof self !== 'undefined' ? self : this, function (RegexValidator, DhcpPacket, DhcpFSM, DhcpSimulation) {

    // Teacher Presentation Scripts for Each Event
    const TEACHER_GUIDES = {
        DEFAULT: {
            title: "EXPLANATION FOR MAM",
            speech: "Mam, this web app simulates DHCP IP address allocation. Devices connect, go through the 4-step DORA handshake, follow an FSM state machine, and validate addresses with Regular Expressions."
        },
        DORA: {
            title: "WHAT TO EXPLAIN FOR DORA HANDSHAKE",
            speech: "Mam, this demonstrates the 4-step DORA handshake. The client broadcasts Discover ➔ the server offers an IP ➔ the client requests that IP ➔ the server sends ACK. The FSM moves from INIT ➔ DISCOVER ➔ OFFER ➔ BOUND."
        },
        RENEW: {
            title: "WHAT TO EXPLAIN FOR T1 RENEWAL",
            speech: "Mam, this demonstrates the T1 Lease Renewal at 50% of lease time. The client sends a unicast DHCPREQUEST directly to the server to extend its IP lease without disconnecting from the network."
        },
        CONFLICT: {
            title: "WHAT TO EXPLAIN FOR ADDRESS CONFLICT",
            speech: "Mam, this simulates an Address Collision. The client sends an ARP probe, detects that another device already has this IP, sends DHCPDECLINE, enters the DECLINED state, and the server quarantines the conflicted address."
        },
        RELEASE: {
            title: "WHAT TO EXPLAIN FOR GRACEFUL RELEASE",
            speech: "Mam, this demonstrates DHCPRELEASE. The device voluntarily surrenders its IP address back to the server's pool and returns to the unconfigured INIT state."
        },
        EXPIRED: {
            title: "WHAT TO EXPLAIN FOR LEASE EXPIRY",
            speech: "Mam, this demonstrates Lease Expiry. When the lease timer reaches 100% without an ACK, the client's network access is revoked, and the server reclaims the IP address into the available pool."
        },
        POOL_FULL: {
            title: "WHAT TO EXPLAIN FOR ALLOCATION ERROR",
            speech: "Mam, this demonstrates an Allocation Error (Pool Exhaustion). All IP addresses in the pool are already taken, so the server cannot allocate an address and rejects the request."
        }
    };

    const FSM_EXPLANATIONS = {
        INIT: {
            title: "INIT (Offline)",
            desc: "Device interface unconfigured (IP: 0.0.0.0). Ready for DHCP discovery.",
            color: "#64748b"
        },
        SELECTING: {
            title: "DISCOVER / SELECTING",
            desc: "Sent DHCPDISCOVER broadcast to 255.255.255.255. Evaluating DHCPOFFERs.",
            color: "#0284c7"
        },
        REQUESTING: {
            title: "OFFER / REQUESTING",
            desc: "Accepted server offer. Broadcasting DHCPREQUEST to claim IP address.",
            color: "#eab308"
        },
        BOUND: {
            title: "BOUND (Active Lease)",
            desc: "Received DHCPACK! IP verified clean via ARP probe. Lease countdown active.",
            color: "#22c55e"
        },
        RENEWING: {
            title: "RENEWING (T1 - 50%)",
            desc: "50% lease elapsed. Sending unicast DHCPREQUEST to extend lease duration.",
            color: "#a855f7"
        },
        REBINDING: {
            title: "REBINDING (T2 - 87.5%)",
            desc: "Server didn't answer renewal. Broadcasting to all DHCP servers on network.",
            color: "#f43f5e"
        },
        RELEASED: {
            title: "RELEASED",
            desc: "Client gracefully surrendered its IP address back to the server pool.",
            color: "#64748b"
        },
        EXPIRED: {
            title: "LEASE EXPIRED",
            desc: "Lease time expired without renewal. IP returned to pool, connection cut.",
            color: "#ef4444"
        },
        DECLINED: {
            title: "CONFLICT / DECLINED",
            desc: "ARP probe detected IP collision! Sent DHCPDECLINE to quarantine address.",
            color: "#ef4444"
        }
    };

    class SimpleUIController {
        constructor() {
            this.sim = new DhcpSimulation();
            this.selectedClientId = 'client-laptop-1';
            this.isUserManuallyEditingRegex = false;
        }

        init() {
            this.bindTopControls();
            this.bindDeviceTabs();
            this.bindActionButtons();
            this.bindRegexTester();
            this.bindSimulationListeners();

            // Set initial state
            this.updateTeacherGuide('DEFAULT');
            this.updateCurrentDeviceView();
            this.renderPoolHeatmap();
            this.renderMessageTimeline();
            this.sim.start(); // Start clock running by default
        }

        updateTeacherGuide(key) {
            const guide = TEACHER_GUIDES[key] || TEACHER_GUIDES.DEFAULT;
            const titleEl = document.getElementById('guide-title');
            const textEl = document.getElementById('guide-text');

            if (titleEl) titleEl.innerText = guide.title;
            if (textEl) textEl.innerText = `"${guide.speech}"`;
        }

        showAllocationError(message) {
            const banner = document.getElementById('error-banner');
            const msgEl = document.getElementById('error-msg');
            if (banner && msgEl) {
                msgEl.innerText = message || "Allocation Error: Address Pool Exhausted! No available IPs.";
                banner.classList.add('show');
                setTimeout(() => {
                    banner.classList.remove('show');
                }, 6000);
            }
        }

        bindTopControls() {
            // Play / Pause
            const playBtn = document.getElementById('btn-play-toggle');
            if (playBtn) {
                playBtn.addEventListener('click', () => {
                    if (this.sim.isRunning) {
                        this.sim.pause();
                        playBtn.innerText = '▶ Resume';
                    } else {
                        this.sim.start();
                        playBtn.innerText = '⏸ Pause';
                    }
                });
            }

            // Speed
            const speedSelect = document.getElementById('select-sim-speed');
            if (speedSelect) {
                speedSelect.addEventListener('change', (e) => {
                    this.sim.setSpeed(parseFloat(e.target.value));
                });
            }

            // Reset
            const resetBtn = document.getElementById('btn-sim-reset');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.sim.reset();
                    this.sim.start();
                    this.isUserManuallyEditingRegex = false;
                    this.updateTeacherGuide('DEFAULT');
                    this.renderMessageTimeline();
                    this.renderPoolHeatmap();
                    this.updateCurrentDeviceView();
                });
            }

            // Scenario Buttons
            const scenarioBtns = document.querySelectorAll('.btn-scenario');
            scenarioBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    scenarioBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const scenarioId = btn.getAttribute('data-scenario');

                    this.isUserManuallyEditingRegex = false;

                    if (scenarioId === 'dora-happy-path') {
                        this.updateTeacherGuide('DORA');
                    } else if (scenarioId === 'address-conflict') {
                        this.updateTeacherGuide('CONFLICT');
                    } else if (scenarioId === 'lease-expiry-reclaim') {
                        this.updateTeacherGuide('EXPIRED');
                    } else if (scenarioId === 'pool-exhaustion') {
                        this.updateTeacherGuide('POOL_FULL');
                        this.showAllocationError("Allocation Error: Address Pool Exhausted! All available IPs are taken.");
                    }

                    this.sim.runScenario(scenarioId);
                    this.updateCurrentDeviceView();
                });
            });
        }

        bindDeviceTabs() {
            const tabsContainer = document.getElementById('device-tabs-container');
            if (!tabsContainer) return;

            const clients = this.sim.getAllClients();
            tabsContainer.innerHTML = clients.map((c) => `
                <div class="device-tab ${c.id === this.selectedClientId ? 'active' : ''}" data-id="${c.id}">
                    <span class="device-tab-status ${c.isBound() ? 'bound' : ''}"></span>
                    <span>${c.hostname}</span>
                </div>
            `).join('');

            tabsContainer.querySelectorAll('.device-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    this.selectedClientId = tab.getAttribute('data-id');
                    this.isUserManuallyEditingRegex = false;
                    tabsContainer.querySelectorAll('.device-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.updateCurrentDeviceView();
                });
            });
        }

        bindActionButtons() {
            // Get IP (DORA)
            const doraBtn = document.getElementById('btn-dora-action');
            if (doraBtn) {
                doraBtn.addEventListener('click', () => {
                    this.isUserManuallyEditingRegex = false;
                    this.updateTeacherGuide('DORA');
                    this.sim.triggerAcquire(this.selectedClientId);
                    this.updateCurrentDeviceView();
                });
            }

            // Renew Lease
            const renewBtn = document.getElementById('btn-renew-action');
            if (renewBtn) {
                renewBtn.addEventListener('click', () => {
                    const client = this.sim.getClient(this.selectedClientId);
                    if (client && client.isBound()) {
                        this.updateTeacherGuide('RENEW');
                        this.sim.triggerRenew(this.selectedClientId);
                        this.updateCurrentDeviceView();
                    } else {
                        alert('Device is not bound to any IP yet. Click "Get IP (DORA)" first.');
                    }
                });
            }

            // Release Lease
            const releaseBtn = document.getElementById('btn-release-action');
            if (releaseBtn) {
                releaseBtn.addEventListener('click', () => {
                    const client = this.sim.getClient(this.selectedClientId);
                    if (client && client.isBound()) {
                        this.updateTeacherGuide('RELEASE');
                        this.sim.triggerRelease(this.selectedClientId);
                        this.updateCurrentDeviceView();
                    }
                });
            }

            // Simulate Conflict
            const conflictBtn = document.getElementById('btn-conflict-action');
            if (conflictBtn) {
                conflictBtn.addEventListener('click', () => {
                    this.updateTeacherGuide('CONFLICT');
                    this.sim.triggerClientConflict(this.selectedClientId);
                    this.updateCurrentDeviceView();
                });
            }
        }

        bindRegexTester() {
            const input = document.getElementById('regex-quick-input');

            if (input) {
                input.addEventListener('input', () => {
                    this.isUserManuallyEditingRegex = true;
                    this.runRegexCheck(input.value.trim());
                });

                input.addEventListener('focus', () => {
                    this.isUserManuallyEditingRegex = true;
                });
            }

            // Quick Shortcut buttons in Card 5
            const syncIpBtn = document.getElementById('btn-regex-sync-ip');
            const syncMacBtn = document.getElementById('btn-regex-sync-mac');
            const testBadIpBtn = document.getElementById('btn-regex-bad-ip');
            const testBadMacBtn = document.getElementById('btn-regex-bad-mac');

            if (syncIpBtn) {
                syncIpBtn.addEventListener('click', () => {
                    const client = this.sim.getClient(this.selectedClientId);
                    const targetIp = (client && client.isBound()) ? client.ip : '192.168.1.100';
                    this.setRegexInput(targetIp, `Current Allocated IP (${client ? client.hostname : ''})`);
                });
            }

            if (syncMacBtn) {
                syncMacBtn.addEventListener('click', () => {
                    const client = this.sim.getClient(this.selectedClientId);
                    const targetMac = client ? client.mac : '00:1E:67:98:2A:1B';
                    this.setRegexInput(targetMac, `Hardware MAC (${client ? client.hostname : ''})`);
                });
            }

            if (testBadIpBtn) {
                testBadIpBtn.addEventListener('click', () => {
                    this.setRegexInput('192.168.1.300', 'Invalid IP Test: Octet 300 > 255');
                });
            }

            if (testBadMacBtn) {
                testBadMacBtn.addEventListener('click', () => {
                    this.setRegexInput('00:1E:67:98:2A:ZZ', 'Invalid MAC Test: Non-hex ZZ');
                });
            }
        }

        setRegexInput(val, label = '') {
            const input = document.getElementById('regex-quick-input');
            if (input) {
                input.value = val;
                this.runRegexCheck(val, label);
            }
        }

        runRegexCheck(val, customLabel = '') {
            const resultPill = document.getElementById('regex-quick-result');
            const note = document.getElementById('regex-quick-note');

            if (!resultPill) return;

            if (!val) {
                resultPill.innerText = 'Waiting for input...';
                resultPill.className = 'regex-result-pill';
                if (note) note.innerText = 'Type any IPv4 address (e.g. 192.168.1.100) or MAC address (e.g. 00:1A:2B:3C:4D:5E).';
                return;
            }

            // 1. Check IPv4
            if (RegexValidator.validateIpv4(val)) {
                const ipCheck = RegexValidator.verifyIpAddress(val);
                if (ipCheck.valid) {
                    resultPill.className = 'regex-result-pill res-valid';
                    resultPill.innerText = `✓ VALID IPv4 ADDRESS: ${val}`;
                    if (note) {
                        note.innerText = customLabel 
                            ? `✓ ${customLabel}: Strict RFC 791 Regex Passed (4 octets, 0-255). Integer: ${ipCheck.integer}`
                            : `✓ Strict RFC 791 Regex Passed: 4 decimal octets (0-255). Integer: ${ipCheck.integer}`;
                    }
                } else {
                    resultPill.className = 'regex-result-pill res-invalid';
                    resultPill.innerText = '✗ INVALID IPv4';
                    if (note) note.innerText = ipCheck.error;
                }
                return;
            }

            // 2. Check MAC
            if (RegexValidator.validateMac(val)) {
                const macCheck = RegexValidator.verifyMacAddress(val);
                if (macCheck.valid) {
                    resultPill.className = 'regex-result-pill res-valid';
                    resultPill.innerText = `✓ VALID MAC ADDRESS: ${macCheck.normalized}`;
                    if (note) {
                        note.innerText = customLabel 
                            ? `✓ ${customLabel}: Strict IEEE 802 Regex Passed (6 pairs of hex digits).`
                            : `✓ Strict IEEE 802 Regex Passed: 6 pairs of hex digits (48-bit hardware MAC).`;
                    }
                } else {
                    resultPill.className = 'regex-result-pill res-invalid';
                    resultPill.innerText = '✗ INVALID MAC';
                    if (note) note.innerText = macCheck.error;
                }
                return;
            }

            // 3. Invalid format
            resultPill.className = 'regex-result-pill res-invalid';
            resultPill.innerText = '✗ INVALID FORMAT (REJECTED BY REGEX)';
            if (note) {
                note.innerText = customLabel 
                    ? `✗ ${customLabel}: String failed regex pattern test (must be 0-255 octets or 6 hex pairs).`
                    : '✗ String failed regular expression match: Expected valid IPv4 (0-255 octets) or MAC (6 hex pairs).';
            }
        }

        bindSimulationListeners() {
            this.sim.addListener((evt) => {
                if (evt.type === 'SIM_TICK') {
                    this.updateClock(evt.simTime);
                    this.updateLeaseMeter();
                    this.renderPoolHeatmap();
                } else if (evt.type === 'PACKET_DISPATCHED') {
                    this.renderMessageTimeline();
                    this.updateCurrentDeviceView();
                    this.renderPoolHeatmap();
                } else if (evt.type === 'CLIENT_UPDATED') {
                    this.updateCurrentDeviceView();
                    this.bindDeviceTabs();
                } else if (evt.type === 'LOG_ENTRY') {
                    if (evt.entry && evt.entry.details && evt.entry.details.type === 'POOL_EXHAUSTION') {
                        this.showAllocationError("Allocation Error: Address Pool Exhausted! No available IPs.");
                    }
                } else if (evt.type === 'SIM_RESET') {
                    this.updateClock(0);
                    this.bindDeviceTabs();
                    this.updateCurrentDeviceView();
                    this.renderPoolHeatmap();
                    this.renderMessageTimeline();
                }
            });
        }

        updateClock(time) {
            const clockEl = document.getElementById('sim-clock');
            if (clockEl) {
                const m = Math.floor(time / 60).toString().padStart(2, '0');
                const s = (time % 60).toString().padStart(2, '0');
                clockEl.innerText = `Clock: ${m}:${s}`;
            }
        }

        updateCurrentDeviceView() {
            const client = this.sim.getClient(this.selectedClientId);
            if (!client) return;

            // Name & MAC
            const nameEl = document.getElementById('dev-name');
            const macEl = document.getElementById('dev-mac');
            const ipEl = document.getElementById('dev-ip');

            if (nameEl) nameEl.innerText = client.hostname;
            if (macEl) macEl.innerText = client.mac;

            // IP display
            if (ipEl) {
                if (client.isBound()) {
                    ipEl.innerText = client.ip;
                    ipEl.className = 'ip-display-pill';

                    // AUTO-SYNC REGEX VALIDATOR WITH ALLOCATED IP!
                    if (!this.isUserManuallyEditingRegex) {
                        this.setRegexInput(client.ip, `Live Allocated IP for ${client.hostname}`);
                    }
                } else {
                    ipEl.innerText = '0.0.0.0 (Unassigned)';
                    ipEl.className = 'ip-display-pill unassigned';

                    // When not bound, sync with client's MAC address
                    if (!this.isUserManuallyEditingRegex) {
                        this.setRegexInput(client.mac, `Hardware MAC for ${client.hostname}`);
                    }
                }
            }

            // Update FSM banner and nodes
            const state = client.getState();
            const stateMeta = FSM_EXPLANATIONS[state] || FSM_EXPLANATIONS.INIT;

            const badgeEl = document.getElementById('fsm-badge');
            const explainEl = document.getElementById('fsm-explain');

            if (badgeEl) {
                badgeEl.innerText = state;
                badgeEl.style.backgroundColor = stateMeta.color;
                badgeEl.style.color = '#fff';
            }

            if (explainEl) {
                explainEl.innerText = stateMeta.desc;
            }

            // Highlight step nodes in the pipeline
            const stepMap = {
                INIT: 'step-init',
                SELECTING: 'step-discover',
                REQUESTING: 'step-offer',
                BOUND: 'step-bound',
                RENEWING: 'step-renewing',
                RELEASED: 'step-released',
                EXPIRED: 'step-released',
                DECLINED: 'step-conflict'
            };

            document.querySelectorAll('.fsm-step-node').forEach(node => {
                node.classList.remove('is-active', 'is-bound', 'is-conflict');
            });

            const activeNodeId = stepMap[state] || 'step-init';
            const activeNode = document.getElementById(activeNodeId);
            if (activeNode) {
                activeNode.classList.add('is-active');
                if (state === 'BOUND') activeNode.classList.add('is-bound');
                if (state === 'DECLINED') activeNode.classList.add('is-conflict');
            }

            this.updateLeaseMeter();

            // Auto Sync Live Changes to MongoDB Atlas
            this.syncWithBackend(client);
        }

        async syncWithBackend(client) {
            if (!client) return;
            const state = client.getState();
            const ip = client.ip || '0.0.0.0';
            const syncKey = `${client.id}_${state}_${ip}`;
            if (this._lastSyncKey === syncKey) return;
            this._lastSyncKey = syncKey;

            try {
                await fetch('/api/dhcp/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: client.id,
                        hostname: client.hostname,
                        mac: client.mac,
                        currentIp: ip,
                        fsmState: state
                    })
                });
                console.log(`✓ Live synced to MongoDB Atlas: ${client.hostname} (${ip}) -> ${state}`);
            } catch (err) {
                // Standalone / offline fallback
            }
        }

        updateLeaseMeter() {
            const client = this.sim.getClient(this.selectedClientId);
            const fill = document.getElementById('dev-lease-fill');
            const label = document.getElementById('dev-lease-label');

            if (!client || !fill || !label) return;

            const metrics = client.getLeaseMetrics(this.sim.simTime);
            if (metrics.active) {
                const remainingPct = 100 - metrics.progressPercent;
                fill.style.width = `${remainingPct}%`;

                if (metrics.isPastT2) fill.className = 'lease-fill rebinding';
                else if (metrics.isPastT1) fill.className = 'lease-fill renewing';
                else fill.className = 'lease-fill';

                label.innerText = `${metrics.remainingSecs}s remaining (${metrics.progressPercent}% elapsed)`;
            } else {
                fill.style.width = '0%';
                label.innerText = 'No active lease';
            }
        }

        renderMessageTimeline() {
            const container = document.getElementById('seq-feed-container');
            if (!container) return;

            const packets = this.sim.packetHistory.slice(0, 15);
            if (packets.length === 0) {
                container.innerHTML = `<div class="empty-hint">No messages yet. Click "Get IP (DORA)" to begin.</div>`;
                return;
            }

            container.innerHTML = packets.map(p => {
                let badgeClass = 'seq-badge-discover';
                if (p.messageType === 2) badgeClass = 'seq-badge-offer';
                else if (p.messageType === 3) badgeClass = 'seq-badge-request';
                else if (p.messageType === 5) badgeClass = 'seq-badge-ack';
                else if (p.messageType === 6) badgeClass = 'seq-badge-nak';
                else if (p.messageType === 4) badgeClass = 'seq-badge-decline';
                else if (p.messageType === 7) badgeClass = 'seq-badge-release';

                return `
                    <div class="seq-item">
                        <span class="seq-item-badge ${badgeClass}">${p.getTypeName()}</span>
                        <span class="seq-item-desc">${p.senderName} ➔ ${p.targetName}: <strong>${p.getSummary()}</strong></span>
                        <span class="seq-item-time">T+${p.simTick}s</span>
                    </div>
                `;
            }).join('');
        }

        renderPoolHeatmap() {
            const container = document.getElementById('pool-grid-container');
            const counter = document.getElementById('pool-counter');
            if (!container) return;

            const entries = this.sim.server.getPoolEntries();
            const stats = this.sim.server.updatePoolStatistics();

            if (counter) {
                counter.innerText = `${stats.active} Leased / ${stats.available} Available / ${stats.conflicted} Conflicted`;
            }

            container.innerHTML = entries.map(e => {
                let statusClass = '';
                if (e.status === 'BOUND') statusClass = 'active';
                else if (e.status === 'CONFLICTED') statusClass = 'conflict';

                const octet = e.ip.split('.')[3];
                return `
                    <div class="pool-dot ${statusClass}" title="${e.ip} (${e.status}) ${e.clientHost ? '- ' + e.clientHost : ''}">
                        .${octet}
                    </div>
                `;
            }).join('');
        }
    }

    return SimpleUIController;
}));

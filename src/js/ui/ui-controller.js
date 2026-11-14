/**
 * Network Address Allocation and DHCP Lease Simulation System
 * Main UI Controller
 * 
 * Binds simulation models, controls, visualizers, modals, and user interactions.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            '../regex-validator',
            '../packet',
            '../fsm',
            '../simulation',
            './fsm-visualizer',
            './sequence-diagram',
            './packet-inspector',
            './ip-matrix',
            './regex-lab'
        ], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../regex-validator'),
            require('../packet'),
            require('../fsm'),
            require('../simulation'),
            require('./fsm-visualizer'),
            require('./sequence-diagram'),
            require('./packet-inspector'),
            require('./ip-matrix'),
            require('./regex-lab')
        );
    } else {
        root.UIController = factory(
            root.RegexValidator,
            root.DhcpPacket,
            root.DhcpFSM,
            root.DhcpSimulation,
            root.FsmVisualizer,
            root.SequenceDiagram,
            root.PacketInspector,
            root.IpMatrix,
            root.RegexLab
        );
    }
}(typeof self !== 'undefined' ? self : this, function (
    RegexValidator,
    DhcpPacket,
    DhcpFSM,
    DhcpSimulation,
    FsmVisualizer,
    SequenceDiagram,
    PacketInspector,
    IpMatrix,
    RegexLab
) {

    class UIController {
        constructor() {
            this.sim = new DhcpSimulation();
            this.selectedClientId = 'client-laptop-1';
            this.activeTab = 'topology'; // topology, sequence, inspector, pool, regexlab, logs

            // Visualizer instances
            this.fsmVisualizer = null;
            this.sequenceDiagram = null;
            this.packetInspector = null;
            this.ipMatrix = null;
            this.regexLab = null;
        }

        init() {
            this.initVisualizers();
            this.bindGlobalControls();
            this.bindSimulationEvents();
            this.renderDeviceList();
            this.renderServerConfig();
            this.renderLogTable();

            // Set initial selected client
            const firstClient = this.sim.getClient(this.selectedClientId) || this.sim.getAllClients()[0];
            if (firstClient) {
                this.selectClient(firstClient.id);
            }

            console.log('NET-DHCP Simulation System initialized.');
        }

        initVisualizers() {
            // FSM Visualizer
            const fsmEl = document.getElementById('fsm-container');
            if (fsmEl) {
                this.fsmVisualizer = new FsmVisualizer(fsmEl);
            }

            // Sequence Diagram
            const seqEl = document.getElementById('sequence-container');
            if (seqEl) {
                this.sequenceDiagram = new SequenceDiagram(seqEl, {
                    onSelectPacket: (pkt) => {
                        this.switchTab('inspector');
                        if (this.packetInspector) {
                            this.packetInspector.inspectPacket(pkt);
                        }
                    }
                });
            }

            // Packet Inspector
            const inspEl = document.getElementById('inspector-container');
            if (inspEl) {
                this.packetInspector = new PacketInspector(inspEl);
            }

            // IP Pool Matrix
            const matrixEl = document.getElementById('matrix-container');
            if (matrixEl) {
                this.ipMatrix = new IpMatrix(matrixEl, this.sim.server, {
                    onInjectConflict: (ip) => {
                        this.sim.server.injectConflict(ip, 'Manual Injection via Matrix');
                        this.ipMatrix.update();
                    },
                    onClearQuarantine: (ip) => {
                        this.sim.server.clearQuarantine(ip);
                        this.ipMatrix.update();
                    }
                });
            }

            // Regex Lab
            const regexEl = document.getElementById('regex-container');
            if (regexEl) {
                this.regexLab = new RegexLab(regexEl);
            }
        }

        bindGlobalControls() {
            // Play / Pause
            const playPauseBtn = document.getElementById('btn-play-pause');
            if (playPauseBtn) {
                playPauseBtn.addEventListener('click', () => {
                    if (this.sim.isRunning) {
                        this.sim.pause();
                        playPauseBtn.innerHTML = '<span class="icon-play"></span> Play';
                        playPauseBtn.classList.remove('btn-pause-active');
                    } else {
                        this.sim.start();
                        playPauseBtn.innerHTML = '<span class="icon-pause"></span> Pause';
                        playPauseBtn.classList.add('btn-pause-active');
                    }
                });
            }

            // Step Button
            const stepBtn = document.getElementById('btn-step');
            if (stepBtn) {
                stepBtn.addEventListener('click', () => {
                    this.sim.step();
                    if (playPauseBtn) {
                        playPauseBtn.innerHTML = '<span class="icon-play"></span> Play';
                        playPauseBtn.classList.remove('btn-pause-active');
                    }
                });
            }

            // Speed Selector
            const speedSelect = document.getElementById('select-speed');
            if (speedSelect) {
                speedSelect.addEventListener('change', (e) => {
                    this.sim.setSpeed(parseFloat(e.target.value));
                });
            }

            // Reset Button
            const resetBtn = document.getElementById('btn-reset');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    if (confirm('Reset simulation clock, leases, and packet history?')) {
                        this.sim.reset();
                        if (playPauseBtn) {
                            playPauseBtn.innerHTML = '<span class="icon-play"></span> Play';
                            playPauseBtn.classList.remove('btn-pause-active');
                        }
                        if (this.sequenceDiagram) this.sequenceDiagram.clear();
                        if (this.packetInspector) this.packetInspector.renderEmpty();
                        this.updateAllViews();
                    }
                });
            }

            // Scenario Runner
            const runScenarioBtn = document.getElementById('btn-run-scenario');
            const scenarioSelect = document.getElementById('select-scenario');
            if (runScenarioBtn && scenarioSelect) {
                runScenarioBtn.addEventListener('click', () => {
                    const scenarioId = scenarioSelect.value;
                    this.sim.runScenario(scenarioId);
                    if (playPauseBtn) {
                        playPauseBtn.innerHTML = '<span class="icon-pause"></span> Pause';
                        playPauseBtn.classList.add('btn-pause-active');
                    }
                });
            }

            // Navigation Tabs
            const tabButtons = document.querySelectorAll('.nav-tab-btn');
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const targetTab = btn.getAttribute('data-tab');
                    this.switchTab(targetTab);
                });
            });

            // Add Device Modal
            const openAddDeviceBtn = document.getElementById('btn-open-add-device');
            const addDeviceModal = document.getElementById('modal-add-device');
            const closeAddModalBtn = document.getElementById('btn-close-add-modal');
            const submitAddBtn = document.getElementById('btn-submit-add-device');
            const randomMacBtn = document.getElementById('btn-random-mac');

            if (openAddDeviceBtn && addDeviceModal) {
                openAddDeviceBtn.addEventListener('click', () => {
                    addDeviceModal.classList.add('is-open');
                    // Pre-fill randomized MAC
                    const macInput = document.getElementById('input-new-mac');
                    if (macInput && !macInput.value) {
                        macInput.value = this.generateRandomMac();
                        this.testMacInput(macInput.value);
                    }
                });
            }

            if (closeAddModalBtn && addDeviceModal) {
                closeAddModalBtn.addEventListener('click', () => {
                    addDeviceModal.classList.remove('is-open');
                });
            }

            if (randomMacBtn) {
                randomMacBtn.addEventListener('click', () => {
                    const macInput = document.getElementById('input-new-mac');
                    if (macInput) {
                        macInput.value = this.generateRandomMac();
                        this.testMacInput(macInput.value);
                    }
                });
            }

            // Live MAC Regex validation in Add Device form
            const newMacInput = document.getElementById('input-new-mac');
            if (newMacInput) {
                newMacInput.addEventListener('input', (e) => {
                    this.testMacInput(e.target.value);
                });
            }

            if (submitAddBtn && addDeviceModal) {
                submitAddBtn.addEventListener('click', () => {
                    const hostInput = document.getElementById('input-new-hostname');
                    const macInput = document.getElementById('input-new-mac');
                    const typeInput = document.getElementById('input-new-type');

                    const hostname = hostInput ? hostInput.value.trim() : 'Device';
                    const mac = macInput ? macInput.value.trim() : '';
                    const deviceType = typeInput ? typeInput.value : 'laptop';

                    const result = this.sim.addClient({ hostname, mac, deviceType });
                    if (result.success) {
                        addDeviceModal.classList.remove('is-open');
                        this.renderDeviceList();
                        this.selectClient(result.client.id);
                        if (hostInput) hostInput.value = '';
                        if (macInput) macInput.value = '';
                    } else {
                        alert(result.error);
                    }
                });
            }

            // Rogue Server Toggle
            const rogueToggle = document.getElementById('toggle-rogue-server');
            if (rogueToggle) {
                rogueToggle.addEventListener('change', (e) => {
                    this.sim.rogueServer.isEnabled = e.target.checked;
                    this.sim.logEvent(
                        e.target.checked ? 'WARN' : 'INFO',
                        `Rogue DHCP Server (10.0.0.1) ${e.target.checked ? 'ENABLED' : 'DISABLED'}`
                    );
                    this.renderServerConfig();
                });
            }

            // Server Config Update Form
            const applyServerConfigBtn = document.getElementById('btn-apply-server-config');
            if (applyServerConfigBtn) {
                applyServerConfigBtn.addEventListener('click', () => {
                    this.applyServerConfigFromInputs();
                });
            }

            // Export Logs Button
            const exportLogsBtn = document.getElementById('btn-export-logs');
            if (exportLogsBtn) {
                exportLogsBtn.addEventListener('click', () => {
                    this.exportLogsAsJson();
                });
            }
        }

        testMacInput(val) {
            const feedback = document.getElementById('feedback-new-mac');
            if (!feedback) return;
            const res = RegexValidator.verifyMacAddress(val);
            if (res.valid) {
                feedback.className = 'input-feedback text-success';
                feedback.innerText = `✓ Valid MAC (${res.normalized})`;
            } else {
                feedback.className = 'input-feedback text-danger';
                feedback.innerText = `✗ ${res.error}`;
            }
        }

        generateRandomMac() {
            const hex = '0123456789ABCDEF';
            let mac = '02';
            for (let i = 0; i < 5; i++) {
                mac += ':' + hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
            }
            return mac;
        }

        bindSimulationEvents() {
            this.sim.addListener((evt) => {
                if (evt.type === 'SIM_TICK') {
                    this.updateClockDisplay(evt.simTime);
                    this.updateLeaseCountdowns(evt.simTime);
                    if (this.ipMatrix) this.ipMatrix.update();
                } else if (evt.type === 'PACKET_DISPATCHED') {
                    if (this.sequenceDiagram) {
                        this.sequenceDiagram.addPacket(evt.packet);
                    }
                    this.animatePacketOnTopology(evt.packet);
                } else if (evt.type === 'CLIENT_UPDATED' || evt.type === 'CLIENT_ADDED' || evt.type === 'CLIENT_REMOVED') {
                    this.renderDeviceList();
                    if (evt.client && evt.client.id === this.selectedClientId && this.fsmVisualizer) {
                        this.fsmVisualizer.setActiveClient(evt.client);
                    }
                } else if (evt.type === 'LOG_ENTRY') {
                    this.addLogTableRow(evt.entry);
                } else if (evt.type === 'SIM_RESET') {
                    this.updateClockDisplay(0);
                    this.renderDeviceList();
                    this.renderLogTable();
                }
            });
        }

        updateClockDisplay(simTime) {
            const clockEl = document.getElementById('sim-clock-display');
            if (clockEl) {
                const mins = Math.floor(simTime / 60).toString().padStart(2, '0');
                const secs = (simTime % 60).toString().padStart(2, '0');
                clockEl.innerText = `T+${mins}:${secs}`;
            }
        }

        updateLeaseCountdowns(simTime) {
            const clients = this.sim.getAllClients();
            clients.forEach(c => {
                const metrics = c.getLeaseMetrics(simTime);
                const barEl = document.getElementById(`lease-bar-${c.id}`);
                const textEl = document.getElementById(`lease-text-${c.id}`);

                if (barEl) {
                    barEl.style.width = `${100 - metrics.progressPercent}%`;
                    if (metrics.isPastT2) barEl.className = 'lease-progress-bar bar-rebinding';
                    else if (metrics.isPastT1) barEl.className = 'lease-progress-bar bar-renewing';
                    else barEl.className = 'lease-progress-bar bar-bound';
                }

                if (textEl) {
                    if (metrics.active) {
                        textEl.innerText = `${metrics.remainingSecs}s remaining (${metrics.progressPercent}%)`;
                    } else {
                        textEl.innerText = 'Unconfigured / No Lease';
                    }
                }
            });
        }

        switchTab(tabId) {
            this.activeTab = tabId;
            document.querySelectorAll('.nav-tab-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
            });

            document.querySelectorAll('.tab-panel').forEach(p => {
                p.classList.toggle('is-visible', p.id === `tab-panel-${tabId}`);
            });
        }

        selectClient(clientId) {
            this.selectedClientId = clientId;
            const client = this.sim.getClient(clientId);
            if (!client) return;

            document.querySelectorAll('.device-card').forEach(card => {
                card.classList.toggle('is-selected', card.getAttribute('data-client-id') === clientId);
            });

            if (this.fsmVisualizer) {
                this.fsmVisualizer.setActiveClient(client);
            }
        }

        renderDeviceList() {
            const container = document.getElementById('device-list-container');
            if (!container) return;

            const clients = this.sim.getAllClients();
            const simTime = this.sim.simTime;

            container.innerHTML = clients.map(c => {
                const stateMeta = c.getStateMeta();
                const metrics = c.getLeaseMetrics(simTime);
                const isSelected = c.id === this.selectedClientId;

                return `
                    <div class="device-card ${isSelected ? 'is-selected' : ''}" data-client-id="${c.id}">
                        <div class="card-top-row">
                            <div class="device-identity">
                                <span class="device-type-icon icon-${c.deviceType}"></span>
                                <div>
                                    <h4 class="device-name">${c.hostname}</h4>
                                    <span class="device-mac"><code>${c.mac}</code></span>
                                </div>
                            </div>
                            <div class="state-badge" style="background:${stateMeta.color}25; border-color:${stateMeta.color}; color:${stateMeta.accentColor || stateMeta.color};">
                                <span class="pulse-dot" style="background:${stateMeta.accentColor || stateMeta.color};"></span>
                                ${stateMeta.name}
                            </div>
                        </div>

                        <!-- Network Address Config -->
                        <div class="device-network-info">
                            <div class="net-field">
                                <span class="label">IP Address:</span>
                                <span class="val font-mono ${c.ip !== '0.0.0.0' ? 'text-emerald' : 'text-muted'}">${c.ip}</span>
                            </div>
                            <div class="net-field">
                                <span class="label">Subnet Mask:</span>
                                <span class="val font-mono">${c.subnetMask}</span>
                            </div>
                            <div class="net-field">
                                <span class="label">Gateway:</span>
                                <span class="val font-mono">${c.gateway}</span>
                            </div>
                        </div>

                        <!-- Lease Expiry Progress Bar -->
                        <div class="lease-bar-wrapper">
                            <div class="lease-bar-track">
                                <div class="lease-progress-bar bar-bound" id="lease-bar-${c.id}" style="width: ${metrics.active ? 100 - metrics.progressPercent : 0}%"></div>
                                <div class="marker-t1" title="T1 Renewal Threshold (50%)" style="left: 50%;"></div>
                                <div class="marker-t2" title="T2 Rebinding Threshold (87.5%)" style="left: 87.5%;"></div>
                            </div>
                            <span class="lease-timer-text" id="lease-text-${c.id}">
                                ${metrics.active ? `${metrics.remainingSecs}s remaining (${metrics.progressPercent}%)` : 'No active lease'}
                            </span>
                        </div>

                        <!-- Action Controls -->
                        <div class="device-card-actions">
                            ${c.getState() === 'INIT' || c.getState() === 'RELEASED' || c.getState() === 'EXPIRED' || c.getState() === 'DECLINED' ? `
                                <button class="btn-xs btn-primary action-dora" data-action="dora" data-client="${c.id}">▶ DORA Handshake</button>
                            ` : ''}

                            ${c.isBound() ? `
                                <button class="btn-xs btn-ghost action-renew" data-action="renew" data-client="${c.id}">⟳ Renew (T1)</button>
                                <button class="btn-xs btn-ghost action-release" data-action="release" data-client="${c.id}">Surrender Lease</button>
                                <button class="btn-xs btn-danger action-conflict" data-action="conflict" data-client="${c.id}" title="Inject ARP collision on this client">ARP Conflict</button>
                            ` : ''}

                            <button class="btn-xs btn-outline-danger action-delete" data-action="delete" data-client="${c.id}" title="Remove device">✕</button>
                        </div>
                    </div>
                `;
            }).join('');

            // Bind card selection & action buttons
            container.querySelectorAll('.device-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return; // ignore click on buttons
                    const cId = card.getAttribute('data-client-id');
                    this.selectClient(cId);
                });
            });

            container.querySelectorAll('button[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.getAttribute('data-action');
                    const cId = btn.getAttribute('data-client');

                    if (action === 'dora') {
                        this.sim.triggerAcquire(cId);
                    } else if (action === 'renew') {
                        this.sim.triggerRenew(cId);
                    } else if (action === 'release') {
                        this.sim.triggerRelease(cId);
                    } else if (action === 'conflict') {
                        this.sim.triggerClientConflict(cId);
                    } else if (action === 'delete') {
                        this.sim.removeClient(cId);
                    }
                });
            });
        }

        renderServerConfig() {
            const s = this.sim.server;
            const r = this.sim.rogueServer;

            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val;
            };

            setVal('cfg-server-ip', s.ip);
            setVal('cfg-subnet-mask', s.subnetMask);
            setVal('cfg-gateway', s.gateway);
            setVal('cfg-dns', s.dns);
            setVal('cfg-pool-start', s.poolStart);
            setVal('cfg-pool-end', s.poolEnd);
            setVal('cfg-lease-duration', s.defaultLeaseDuration);

            const rogueBadge = document.getElementById('rogue-server-status');
            if (rogueBadge) {
                rogueBadge.innerText = r.isEnabled ? 'ONLINE (ACTIVE)' : 'OFFLINE (DISABLED)';
                rogueBadge.className = `status-pill ${r.isEnabled ? 'pill-danger' : 'pill-muted'}`;
            }
        }

        applyServerConfigFromInputs() {
            const getVal = id => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : '';
            };

            const ip = getVal('cfg-server-ip');
            const mask = getVal('cfg-subnet-mask');
            const gateway = getVal('cfg-gateway');
            const dns = getVal('cfg-dns');
            const poolStart = getVal('cfg-pool-start');
            const poolEnd = getVal('cfg-pool-end');
            const leaseSecs = parseInt(getVal('cfg-lease-duration'), 10) || 120;

            // Regex Validate all fields
            if (!RegexValidator.validateIpv4(ip)) return alert('Invalid Server IP address');
            if (!RegexValidator.validateSubnetMask(mask)) return alert('Invalid Subnet Mask format');
            if (!RegexValidator.validateIpv4(gateway)) return alert('Invalid Gateway IP');
            if (!RegexValidator.validateIpv4(dns)) return alert('Invalid DNS IP');
            if (!RegexValidator.validateIpv4(poolStart)) return alert('Invalid Pool Start IP');
            if (!RegexValidator.validateIpv4(poolEnd)) return alert('Invalid Pool End IP');

            const startInt = RegexValidator.ipToInt(poolStart);
            const endInt = RegexValidator.ipToInt(poolEnd);
            if (startInt > endInt) return alert('Pool Start IP must be less than or equal to Pool End IP');

            this.sim.server.ip = ip;
            this.sim.server.subnetMask = mask;
            this.sim.server.gateway = gateway;
            this.sim.server.dns = dns;
            this.sim.server.poolStart = poolStart;
            this.sim.server.poolEnd = poolEnd;
            this.sim.server.defaultLeaseDuration = leaseSecs;
            this.sim.server.rebuildAddressPool();

            if (this.ipMatrix) this.ipMatrix.update();
            this.sim.logEvent('SUCCESS', 'Server configuration updated and IP address pool rebuilt');
            alert('DHCP Server configuration applied successfully.');
        }

        animatePacketOnTopology(packet) {
            // Visual wire packet animation indicator
            const topoStatus = document.getElementById('topology-wire-activity');
            if (topoStatus) {
                topoStatus.className = 'wire-pulse-active';
                setTimeout(() => {
                    topoStatus.className = '';
                }, 600);
            }
        }

        renderLogTable() {
            const tableBody = document.getElementById('log-table-body');
            if (!tableBody) return;

            tableBody.innerHTML = this.sim.eventLog.slice(0, 50).map(entry => this.formatLogEntryRow(entry)).join('');
        }

        addLogTableRow(entry) {
            const tableBody = document.getElementById('log-table-body');
            if (!tableBody) return;

            const tr = document.createElement('tr');
            tr.innerHTML = this.formatLogEntryRow(entry, true);
            tableBody.insertBefore(tr, tableBody.firstChild);

            if (tableBody.children.length > 100) {
                tableBody.removeChild(tableBody.lastChild);
            }
        }

        formatLogEntryRow(entry, innerOnly = false) {
            const levelClass = `log-${entry.level.toLowerCase()}`;
            const detailStr = entry.details && entry.details.summary ? entry.details.summary : JSON.stringify(entry.details);

            const content = `
                <td class="log-time-col">T+${entry.simTime}s</td>
                <td class="log-level-col"><span class="badge ${levelClass}">${entry.level}</span></td>
                <td class="log-title-col"><strong>${entry.title}</strong></td>
                <td class="log-detail-col"><code>${detailStr}</code></td>
            `;

            return innerOnly ? content : `<tr class="${levelClass}">${content}</tr>`;
        }

        exportLogsAsJson() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.sim.eventLog, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `dhcp-simulation-logs-T${this.sim.simTime}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        }

        updateAllViews() {
            this.renderDeviceList();
            this.renderServerConfig();
            this.renderLogTable();
            if (this.ipMatrix) this.ipMatrix.update();
            const client = this.sim.getClient(this.selectedClientId);
            if (client && this.fsmVisualizer) {
                this.fsmVisualizer.setActiveClient(client);
            }
        }
    }

    return UIController;
}));

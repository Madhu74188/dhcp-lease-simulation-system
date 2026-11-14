/**
 * Network Address Allocation and DHCP Lease Simulation System
 * Finite-State Machine (FSM) Interactive Visualizer
 * 
 * Renders an animated SVG/Canvas node-link diagram of the RFC 2131 lease states.
 * Highlights the current active state with pulsing glow and displays transition history.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['../fsm'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../fsm'));
    } else {
        root.FsmVisualizer = factory(root.DhcpFSM);
    }
}(typeof self !== 'undefined' ? self : this, function (DhcpFSM) {

    const { LEASE_STATES, TRANSITIONS } = DhcpFSM;

    // Node Layout Positions in SVG Coordinate Space (viewBox 0 0 800 480)
    const STATE_NODE_POSITIONS = {
        INIT:       { x: 100, y: 110, label: 'INIT',       sub: 'Offline' },
        SELECTING:  { x: 320, y: 80,  label: 'SELECTING',  sub: 'Discover' },
        REQUESTING: { x: 550, y: 80,  label: 'REQUESTING', sub: 'Offer' },
        BOUND:      { x: 680, y: 240, label: 'BOUND',      sub: 'Active Lease' },
        RENEWING:   { x: 570, y: 400, label: 'RENEWING',   sub: 'T1 (50%)' },
        REBINDING:  { x: 350, y: 410, label: 'REBINDING',  sub: 'T2 (87.5%)' },
        EXPIRED:    { x: 140, y: 390, label: 'EXPIRED',    sub: 'T3 Timeout' },
        RELEASED:   { x: 90,  y: 250, label: 'RELEASED',   sub: 'Relinquished' },
        DECLINED:   { x: 370, y: 240, label: 'DECLINED',   sub: 'Conflict' }
    };

    class FsmVisualizer {
        constructor(containerElement, options = {}) {
            this.container = typeof containerElement === 'string' ? document.getElementById(containerElement) : containerElement;
            this.activeState = 'INIT';
            this.activeClientId = null;
            this.activeClientHost = 'Device';
            this.selectedNode = null;
            this.onStateClick = options.onStateClick || null;

            if (this.container) {
                this.render();
            }
        }

        setActiveClient(client) {
            if (!client) return;
            this.activeClientId = client.id;
            this.activeClientHost = client.hostname;
            this.setActiveState(client.getState(), client.fsm ? client.fsm.history : []);
        }

        setActiveState(stateId, history = []) {
            this.activeState = stateId || 'INIT';
            this.updateActiveNodeVisuals();
            if (history && history.length > 0) {
                this.renderHistory(history);
            }
        }

        render() {
            this.container.innerHTML = `
                <div class="fsm-visualizer-card">
                    <div class="fsm-header">
                        <div class="fsm-title-group">
                            <h3 class="fsm-title"><i class="icon-fsm"></i> Client Finite-State Machine</h3>
                            <span class="fsm-client-badge" id="fsm-active-client-label">${this.activeClientHost}</span>
                        </div>
                        <div class="fsm-active-state-pill" id="fsm-current-pill">
                            <span class="pulse-dot"></span>
                            <span class="state-name">${this.activeState}</span>
                        </div>
                    </div>

                    <div class="fsm-canvas-wrapper">
                        <svg class="fsm-svg" viewBox="0 0 800 480" id="fsm-svg-canvas">
                            <defs>
                                <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
                                    <feGaussianBlur stdDeviation="6" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                                <filter id="glow-amber" x="-30%" y="-30%" width="160%" height="160%">
                                    <feGaussianBlur stdDeviation="6" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                                <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
                                    <feGaussianBlur stdDeviation="6" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                                <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
                                </marker>
                                <marker id="arrow-active" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
                                </marker>
                            </defs>

                            <!-- Transition Connectors -->
                            <g class="fsm-edges" id="fsm-edges-group">
                                <!-- INIT -> SELECTING -->
                                <path d="M 140 100 Q 220 70 280 80" class="edge-line" marker-end="url(#arrow)" data-from="INIT" data-to="SELECTING" />
                                <!-- SELECTING -> REQUESTING -->
                                <path d="M 360 80 L 510 80" class="edge-line" marker-end="url(#arrow)" data-from="SELECTING" data-to="REQUESTING" />
                                <!-- REQUESTING -> BOUND -->
                                <path d="M 585 105 Q 650 140 660 205" class="edge-line" marker-end="url(#arrow)" data-from="REQUESTING" data-to="BOUND" />
                                <!-- BOUND -> RENEWING -->
                                <path d="M 660 275 Q 650 350 605 385" class="edge-line" marker-end="url(#arrow)" data-from="BOUND" data-to="RENEWING" />
                                <!-- RENEWING -> BOUND (Renewal success) -->
                                <path d="M 590 375 Q 610 300 645 260" class="edge-line edge-dashed" marker-end="url(#arrow)" data-from="RENEWING" data-to="BOUND" />
                                <!-- RENEWING -> REBINDING -->
                                <path d="M 530 405 L 390 410" class="edge-line" marker-end="url(#arrow)" data-from="RENEWING" data-to="REBINDING" />
                                <!-- REBINDING -> BOUND (Rebinding success) -->
                                <path d="M 370 380 Q 520 280 645 250" class="edge-line edge-dashed" marker-end="url(#arrow)" data-from="REBINDING" data-to="BOUND" />
                                <!-- REBINDING -> EXPIRED -->
                                <path d="M 310 410 L 180 395" class="edge-line" marker-end="url(#arrow)" data-from="REBINDING" data-to="EXPIRED" />
                                <!-- EXPIRED -> INIT -->
                                <path d="M 125 355 L 105 145" class="edge-line" marker-end="url(#arrow)" data-from="EXPIRED" data-to="INIT" />
                                <!-- BOUND -> RELEASED -->
                                <path d="M 640 245 Q 380 200 130 245" class="edge-line" marker-end="url(#arrow)" data-from="BOUND" data-to="RELEASED" />
                                <!-- RELEASED -> INIT -->
                                <path d="M 95 215 L 95 145" class="edge-line" marker-end="url(#arrow)" data-from="RELEASED" data-to="INIT" />
                                <!-- REQUESTING -> DECLINED -->
                                <path d="M 525 110 L 405 215" class="edge-line edge-warning" marker-end="url(#arrow)" data-from="REQUESTING" data-to="DECLINED" />
                                <!-- DECLINED -> INIT -->
                                <path d="M 335 230 Q 200 190 135 130" class="edge-line edge-warning" marker-end="url(#arrow)" data-from="DECLINED" data-to="INIT" />
                            </g>

                            <!-- Edge Labels -->
                            <g class="fsm-edge-labels">
                                <text x="210" y="65" class="edge-text">DHCPDISCOVER</text>
                                <text x="430" y="70" class="edge-text">DHCPOFFER</text>
                                <text x="660" y="145" class="edge-text">DHCPACK</text>
                                <text x="670" y="340" class="edge-text">T1 (50%)</text>
                                <text x="450" y="425" class="edge-text">T2 (87.5%)</text>
                                <text x="235" y="425" class="edge-text">Lease Expired</text>
                                <text x="360" y="215" class="edge-text text-warn">DHCPRELEASE</text>
                                <text x="480" y="185" class="edge-text text-err">ARP Conflict / DECLINE</text>
                            </g>

                            <!-- State Nodes -->
                            <g class="fsm-nodes" id="fsm-nodes-group">
                                ${Object.keys(STATE_NODE_POSITIONS).map(stateId => {
                                    const pos = STATE_NODE_POSITIONS[stateId];
                                    const meta = LEASE_STATES[stateId] || {};
                                    return `
                                        <g class="fsm-node ${stateId === this.activeState ? 'is-active' : ''}" 
                                           id="node-${stateId}" 
                                           data-state="${stateId}"
                                           transform="translate(${pos.x}, ${pos.y})">
                                            <circle class="node-halo" r="42" />
                                            <circle class="node-circle" r="34" fill="#0f172a" stroke="${meta.color || '#64748b'}" stroke-width="2.5" />
                                            <text class="node-title" y="-3">${pos.label}</text>
                                            <text class="node-sub" y="14">${pos.sub}</text>
                                        </g>
                                    `;
                                }).join('')}
                            </g>
                        </svg>
                    </div>

                    <!-- State Details & RFC Spec Drawer -->
                    <div class="fsm-details-panel" id="fsm-details-panel">
                        <div class="fsm-details-header">
                            <span class="details-title" id="fsm-info-title">State: ${this.activeState}</span>
                            <span class="details-rfc" id="fsm-info-rfc">${LEASE_STATES[this.activeState]?.rfcSection || ''}</span>
                        </div>
                        <p class="details-desc" id="fsm-info-desc">${LEASE_STATES[this.activeState]?.description || ''}</p>
                    </div>

                    <!-- FSM Transition History -->
                    <div class="fsm-history-strip" id="fsm-history-strip">
                        <div class="history-label">Transition History:</div>
                        <div class="history-crumbs" id="fsm-history-crumbs">
                            <span class="crumb active">INIT</span>
                        </div>
                    </div>
                </div>
            `;

            this.bindInteractions();
            this.updateActiveNodeVisuals();
        }

        bindInteractions() {
            const nodes = this.container.querySelectorAll('.fsm-node');
            nodes.forEach(node => {
                node.addEventListener('click', () => {
                    const stateId = node.getAttribute('data-state');
                    this.showStateDetails(stateId);
                    if (typeof this.onStateClick === 'function') {
                        this.onStateClick(stateId);
                    }
                });
            });
        }

        showStateDetails(stateId) {
            const meta = LEASE_STATES[stateId];
            if (!meta) return;

            const titleEl = this.container.querySelector('#fsm-info-title');
            const rfcEl = this.container.querySelector('#fsm-info-rfc');
            const descEl = this.container.querySelector('#fsm-info-desc');

            if (titleEl) titleEl.innerText = `State: ${meta.name} (${meta.label})`;
            if (rfcEl) rfcEl.innerText = meta.rfcSection;
            if (descEl) descEl.innerText = meta.description;
        }

        updateActiveNodeVisuals() {
            const clientLabel = this.container.querySelector('#fsm-active-client-label');
            if (clientLabel) clientLabel.innerText = this.activeClientHost;

            const pill = this.container.querySelector('#fsm-current-pill');
            const meta = LEASE_STATES[this.activeState] || LEASE_STATES.INIT;

            if (pill) {
                pill.style.borderColor = meta.color;
                pill.style.backgroundColor = `${meta.color}20`;
                const nameEl = pill.querySelector('.state-name');
                if (nameEl) {
                    nameEl.innerText = meta.name;
                    nameEl.style.color = meta.accentColor || meta.color;
                }
            }

            // Update node highlights
            const allNodes = this.container.querySelectorAll('.fsm-node');
            allNodes.forEach(node => {
                const s = node.getAttribute('data-state');
                if (s === this.activeState) {
                    node.classList.add('is-active');
                    const circle = node.querySelector('.node-circle');
                    if (circle) {
                        circle.setAttribute('stroke', meta.accentColor || meta.color);
                        circle.setAttribute('stroke-width', '4');
                        circle.style.filter = 'url(#glow-emerald)';
                    }
                } else {
                    node.classList.remove('is-active');
                    const circle = node.querySelector('.node-circle');
                    if (circle) {
                        const m = LEASE_STATES[s];
                        circle.setAttribute('stroke', m ? m.color : '#64748b');
                        circle.setAttribute('stroke-width', '2.5');
                        circle.style.filter = 'none';
                    }
                }
            });

            this.showStateDetails(this.activeState);
        }

        renderHistory(history) {
            const crumbsEl = this.container.querySelector('#fsm-history-crumbs');
            if (!crumbsEl) return;

            const recent = history.slice(-6);
            crumbsEl.innerHTML = recent.map((item, idx) => {
                const isLatest = idx === recent.length - 1;
                const meta = LEASE_STATES[item.to] || {};
                return `
                    <span class="crumb ${isLatest ? 'active' : ''}" style="border-color:${meta.color || '#475569'}">
                        ${item.to}
                        <small class="crumb-event">${item.event}</small>
                    </span>
                    ${!isLatest ? '<span class="crumb-arrow">➔</span>' : ''}
                `;
            }).join('');
        }
    }

    return FsmVisualizer;
}));

/**
 * Network Address Allocation and DHCP Lease Simulation System
 * Message Exchange Sequence (Ladder) Diagram Visualizer
 * 
 * Renders real-time UML ladder sequence diagrams depicting packet flows
 * between Client, Network Switch, Primary Server, and Rogue Server.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['../packet'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../packet'));
    } else {
        root.SequenceDiagram = factory(root.DhcpPacket);
    }
}(typeof self !== 'undefined' ? self : this, function (DhcpPacket) {

    const { DHCP_MESSAGE_TYPES } = DhcpPacket;

    const MESSAGE_TYPE_COLORS = {
        1: { bg: '#0284c7', text: '#e0f2fe', name: 'DISCOVER' },  // Blue
        2: { bg: '#10b981', text: '#d1fae5', name: 'OFFER' },     // Green
        3: { bg: '#f59e0b', text: '#fef3c7', name: 'REQUEST' },   // Amber
        4: { bg: '#a855f7', text: '#f3e8ff', name: 'DECLINE' },   // Purple
        5: { bg: '#059669', text: '#ecfdf5', name: 'ACK' },       // Emerald
        6: { bg: '#dc2626', text: '#fee2e2', name: 'NAK' },       // Red
        7: { bg: '#64748b', text: '#f1f5f9', name: 'RELEASE' },   // Slate
        90: { bg: '#06b6d4', text: '#cffafe', name: 'ARP PROBE' },// Cyan
        91: { bg: '#e11d48', text: '#ffe4e6', name: 'ARP REPLY' } // Rose
    };

    class SequenceDiagram {
        constructor(containerElement, options = {}) {
            this.container = typeof containerElement === 'string' ? document.getElementById(containerElement) : containerElement;
            this.packets = [];
            this.selectedPacketId = null;
            this.autoScroll = true;
            this.filterClient = 'ALL';
            this.filterType = 'ALL';
            this.onSelectPacket = options.onSelectPacket || null;

            if (this.container) {
                this.render();
            }
        }

        addPacket(packet) {
            this.packets.push(packet);
            if (this.packets.length > 150) {
                this.packets.shift();
            }
            this.renderRows();
        }

        clear() {
            this.packets = [];
            this.selectedPacketId = null;
            this.renderRows();
        }

        render() {
            this.container.innerHTML = `
                <div class="sequence-diagram-card">
                    <div class="seq-header">
                        <div class="seq-title-group">
                            <h3 class="seq-title"><i class="icon-exchange"></i> Message Exchange Sequence Diagram</h3>
                            <span class="seq-count-badge" id="seq-count">0 messages</span>
                        </div>
                        <div class="seq-controls">
                            <label class="seq-filter-label">
                                Filter:
                                <select class="seq-select" id="seq-filter-type">
                                    <option value="ALL">All Message Types</option>
                                    <option value="1">DHCPDISCOVER</option>
                                    <option value="2">DHCPOFFER</option>
                                    <option value="3">DHCPREQUEST</option>
                                    <option value="5">DHCPACK</option>
                                    <option value="6">DHCPNAK</option>
                                    <option value="4">DHCPDECLINE</option>
                                    <option value="7">DHCPRELEASE</option>
                                    <option value="90">ARP Probe / Collisions</option>
                                </select>
                            </label>
                            <button class="btn-sm btn-ghost" id="seq-clear-btn" title="Clear Timeline">Clear</button>
                        </div>
                    </div>

                    <!-- Actor Lifelines Header -->
                    <div class="seq-actors-bar">
                        <div class="seq-actor client-actor">
                            <div class="actor-box"><i class="icon-device"></i> Client Device</div>
                            <div class="actor-line"></div>
                        </div>
                        <div class="seq-actor switch-actor">
                            <div class="actor-box"><i class="icon-switch"></i> Network Switch</div>
                            <div class="actor-line"></div>
                        </div>
                        <div class="seq-actor server-actor">
                            <div class="actor-box"><i class="icon-server"></i> DHCP Server</div>
                            <div class="actor-line"></div>
                        </div>
                    </div>

                    <!-- Scrollable Sequence Timeline -->
                    <div class="seq-timeline-container" id="seq-timeline-scroll">
                        <div class="seq-timeline-rows" id="seq-timeline-rows">
                            <div class="seq-empty-state">No DHCP packet exchanges recorded yet. Trigger DORA on a device to begin.</div>
                        </div>
                    </div>
                </div>
            `;

            this.bindEvents();
        }

        bindEvents() {
            const clearBtn = this.container.querySelector('#seq-clear-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clear());
            }

            const filterSelect = this.container.querySelector('#seq-filter-type');
            if (filterSelect) {
                filterSelect.addEventListener('change', (e) => {
                    this.filterType = e.target.value;
                    this.renderRows();
                });
            }
        }

        renderRows() {
            const rowsContainer = this.container.querySelector('#seq-timeline-rows');
            const countBadge = this.container.querySelector('#seq-count');
            if (!rowsContainer) return;

            let filtered = this.packets;
            if (this.filterType !== 'ALL') {
                const targetCode = parseInt(this.filterType, 10);
                filtered = filtered.filter(p => p.messageType === targetCode || (targetCode === 90 && (p.messageType === 90 || p.messageType === 91)));
            }

            if (countBadge) {
                countBadge.innerText = `${filtered.length} exchange${filtered.length === 1 ? '' : 's'}`;
            }

            if (filtered.length === 0) {
                rowsContainer.innerHTML = `<div class="seq-empty-state">No matching message exchanges.</div>`;
                return;
            }

            rowsContainer.innerHTML = filtered.map(pkt => {
                const isSelected = pkt.id === this.selectedPacketId;
                const typeStyle = MESSAGE_TYPE_COLORS[pkt.messageType] || { bg: '#475569', text: '#ffffff', name: pkt.getTypeName() };
                const isClientToServer = pkt.senderRole === 'Client';
                const isBroadcast = pkt.isBroadcast;

                // Format Arrow direction
                // Client (Left: 16%) <-> Switch (Center: 50%) <-> Server (Right: 84%)
                let arrowClass = isClientToServer ? 'arrow-c2s' : 'arrow-s2c';
                if (pkt.messageType === 90 || pkt.messageType === 91) {
                    arrowClass = 'arrow-arp';
                }

                return `
                    <div class="seq-row ${isSelected ? 'is-selected' : ''}" data-packet-id="${pkt.id}">
                        <div class="seq-time-col">
                            <span class="time-tick">T+${pkt.simTick}s</span>
                        </div>

                        <div class="seq-exchange-col">
                            <div class="seq-arrow-track ${arrowClass}">
                                <div class="seq-arrow-line">
                                    <span class="seq-arrow-head"></span>
                                </div>
                                <div class="seq-badge" style="background:${typeStyle.bg}; color:${typeStyle.text};">
                                    ${typeStyle.name}
                                </div>
                            </div>
                        </div>

                        <div class="seq-details-col">
                            <span class="seq-summary-text">${pkt.getSummary()}</span>
                            <span class="seq-meta-pill">xid: ${pkt.xid}</span>
                            ${isBroadcast ? '<span class="seq-bcast-pill">BCAST</span>' : '<span class="seq-unicast-pill">UNICAST</span>'}
                        </div>
                    </div>
                `;
            }).join('');

            // Bind click to open packet inspector
            rowsContainer.querySelectorAll('.seq-row').forEach(row => {
                row.addEventListener('click', () => {
                    const pktId = row.getAttribute('data-packet-id');
                    this.selectedPacketId = pktId;
                    rowsContainer.querySelectorAll('.seq-row').forEach(r => r.classList.remove('is-selected'));
                    row.classList.add('is-selected');

                    const found = this.packets.find(p => p.id === pktId);
                    if (found && typeof this.onSelectPacket === 'function') {
                        this.onSelectPacket(found);
                    }
                });
            });

            // Auto-scroll to bottom
            if (this.autoScroll) {
                const scrollContainer = this.container.querySelector('#seq-timeline-scroll');
                if (scrollContainer) {
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                }
            }
        }
    }

    return SequenceDiagram;
}));

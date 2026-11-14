/**
 * Network Address Allocation and DHCP Lease Simulation System
 * RFC 2131 Deep Packet Inspector
 * 
 * Renders decoded protocol headers, options table, and regex verification badges
 * for captured DHCP and ARP packets.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['../regex-validator', '../packet'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../regex-validator'), require('../packet'));
    } else {
        root.PacketInspector = factory(root.RegexValidator, root.DhcpPacket);
    }
}(typeof self !== 'undefined' ? self : this, function (RegexValidator, DhcpPacket) {

    class PacketInspector {
        constructor(containerElement) {
            this.container = typeof containerElement === 'string' ? document.getElementById(containerElement) : containerElement;
            this.currentPacket = null;

            if (this.container) {
                this.renderEmpty();
            }
        }

        inspectPacket(packet) {
            this.currentPacket = packet;
            this.render();
        }

        renderEmpty() {
            this.container.innerHTML = `
                <div class="packet-inspector-card">
                    <div class="inspector-header">
                        <h3 class="inspector-title"><i class="icon-inspect"></i> RFC 2131 Packet Inspector</h3>
                        <span class="inspector-subtitle">Select any message in the sequence or log to inspect full headers</span>
                    </div>
                    <div class="inspector-empty">
                        <div class="empty-icon-shield"></div>
                        <p>No packet selected. Click on a packet row in the sequence diagram above to view decoded RFC 2131 byte structures and DHCP options.</p>
                    </div>
                </div>
            `;
        }

        render() {
            if (!this.currentPacket) {
                this.renderEmpty();
                return;
            }

            const pkt = this.currentPacket;
            const validation = pkt.validatePacket ? pkt.validatePacket() : { valid: true, errors: [] };
            const opName = pkt.op === 1 ? '1 (BOOTREQUEST)' : pkt.op === 2 ? '2 (BOOTREPLY)' : `${pkt.op}`;
            const flagName = (pkt.flags & 0x8000) !== 0 ? '0x8000 (Broadcast)' : '0x0000 (Unicast)';

            const optionsList = Object.values(pkt.options || {});

            this.container.innerHTML = `
                <div class="packet-inspector-card">
                    <div class="inspector-header">
                        <div class="inspector-title-group">
                            <h3 class="inspector-title"><i class="icon-inspect"></i> Packet Inspector: <span class="highlight-type">${pkt.getTypeName()}</span></h3>
                            <span class="inspector-xid">xid: ${pkt.xid}</span>
                        </div>
                        <div class="inspector-status-badge ${validation.valid ? 'badge-valid' : 'badge-invalid'}">
                            ${validation.valid ? '✓ Regex Validated RFC 2131' : '⚠ Validation Warning'}
                        </div>
                    </div>

                    <!-- Network Layer Frame Overview -->
                    <div class="inspector-layers-grid">
                        <div class="layer-pill layer-ethernet">
                            <span class="layer-title">Ethernet II</span>
                            <span class="layer-field">Src: <code>${pkt.srcMac}</code></span>
                            <span class="layer-field">Dst: <code>${pkt.dstMac}</code></span>
                        </div>
                        <div class="layer-pill layer-ip">
                            <span class="layer-title">IPv4 Layer</span>
                            <span class="layer-field">Src: <code>${pkt.srcIp}</code></span>
                            <span class="layer-field">Dst: <code>${pkt.dstIp}</code></span>
                        </div>
                        <div class="layer-pill layer-udp">
                            <span class="layer-title">UDP Datagram</span>
                            <span class="layer-field">Src Port: <code>${pkt.srcPort}</code></span>
                            <span class="layer-field">Dst Port: <code>${pkt.dstPort}</code></span>
                        </div>
                    </div>

                    <!-- RFC 2131 Header Table -->
                    <div class="inspector-section">
                        <h4 class="section-title">BOOTP / DHCP Fixed Header Fields (RFC 2131)</h4>
                        <div class="inspector-grid">
                            <div class="field-box">
                                <span class="field-name">Op Code (op)</span>
                                <span class="field-value">${opName}</span>
                            </div>
                            <div class="field-box">
                                <span class="field-name">Hardware Type (htype)</span>
                                <span class="field-value">1 (10Mb Ethernet)</span>
                            </div>
                            <div class="field-box">
                                <span class="field-name">Hardware Length (hlen)</span>
                                <span class="field-value">6 octets</span>
                            </div>
                            <div class="field-box">
                                <span class="field-name">Hops (hops)</span>
                                <span class="field-value">${pkt.hops}</span>
                            </div>
                            <div class="field-box field-highlight">
                                <span class="field-name">Transaction ID (xid)</span>
                                <span class="field-value"><code>${pkt.xid}</code></span>
                            </div>
                            <div class="field-box">
                                <span class="field-name">Seconds (secs)</span>
                                <span class="field-value">${pkt.secs}s</span>
                            </div>
                            <div class="field-box">
                                <span class="field-name">Flags (flags)</span>
                                <span class="field-value">${flagName}</span>
                            </div>
                            <div class="field-box">
                                <span class="field-name">Client IP (ciaddr)</span>
                                <span class="field-value"><code>${pkt.ciaddr}</code></span>
                            </div>
                            <div class="field-box field-highlight">
                                <span class="field-name">'Your' Offered IP (yiaddr)</span>
                                <span class="field-value"><code>${pkt.yiaddr}</code></span>
                            </div>
                            <div class="field-box">
                                <span class="field-name">Server IP (siaddr)</span>
                                <span class="field-value"><code>${pkt.siaddr}</code></span>
                            </div>
                            <div class="field-box">
                                <span class="field-name">Relay Agent IP (giaddr)</span>
                                <span class="field-value"><code>${pkt.giaddr}</code></span>
                            </div>
                            <div class="field-box field-highlight">
                                <span class="field-name">Client MAC (chaddr)</span>
                                <span class="field-value"><code>${pkt.chaddr}</code></span>
                            </div>
                        </div>
                    </div>

                    <!-- DHCP Options Table -->
                    <div class="inspector-section">
                        <h4 class="section-title">DHCP Options (RFC 2132)</h4>
                        <table class="options-table">
                            <thead>
                                <tr>
                                    <th>Tag</th>
                                    <th>Option Name</th>
                                    <th>Value</th>
                                    <th>Format Validation</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${optionsList.map(opt => {
                                    let valStr = typeof opt.value === 'object' ? JSON.stringify(opt.value) : String(opt.value);
                                    let valCheck = 'Valid';
                                    let badgeClass = 'badge-ok';

                                    if (opt.tag === 1 || opt.tag === 3 || opt.tag === 6 || opt.tag === 50 || opt.tag === 54) {
                                        if (!RegexValidator.validateIpv4(valStr)) {
                                            valCheck = 'Invalid IPv4';
                                            badgeClass = 'badge-err';
                                        }
                                    }

                                    return `
                                        <tr>
                                            <td class="tag-cell">#${opt.tag}</td>
                                            <td class="name-cell">${opt.name}</td>
                                            <td class="value-cell"><code>${valStr}</code></td>
                                            <td class="val-check-cell"><span class="${badgeClass}">${valCheck}</span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    }

    return PacketInspector;
}));

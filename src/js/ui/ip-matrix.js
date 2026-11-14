/**
 * Network Address Allocation and DHCP Lease Simulation System
 * IP Address Pool & Subnet Matrix Visualizer
 * 
 * Renders an interactive visual grid of the DHCP address pool with live status badges,
 * lease countdowns, conflict flags, and administrative controls.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.IpMatrix = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    class IpMatrix {
        constructor(containerElement, server, options = {}) {
            this.container = typeof containerElement === 'string' ? document.getElementById(containerElement) : containerElement;
            this.server = server;
            this.filterStatus = 'ALL';
            this.selectedIp = null;
            this.onInjectConflict = options.onInjectConflict || null;
            this.onClearQuarantine = options.onClearQuarantine || null;

            if (this.container && this.server) {
                this.render();
            }
        }

        setServer(server) {
            this.server = server;
            this.update();
        }

        render() {
            const stats = this.server.updatePoolStatistics();

            this.container.innerHTML = `
                <div class="ip-matrix-card">
                    <div class="matrix-header">
                        <div class="matrix-title-group">
                            <h3 class="matrix-title"><i class="icon-grid"></i> DHCP Address Pool Matrix</h3>
                            <span class="matrix-range">${this.server.poolStart} — ${this.server.poolEnd}</span>
                        </div>
                        <div class="matrix-filters">
                            <button class="filter-chip active" data-filter="ALL">All (${stats.total})</button>
                            <button class="filter-chip" data-filter="BOUND">Active (${stats.active})</button>
                            <button class="filter-chip" data-filter="AVAILABLE">Available (${stats.available})</button>
                            <button class="filter-chip" data-filter="CONFLICTED">Conflicted (${stats.conflicted})</button>
                        </div>
                    </div>

                    <!-- Pool Utilization Meter -->
                    <div class="matrix-utilization-bar">
                        <div class="utilization-label">
                            <span>Pool Utilization</span>
                            <span class="utilization-pct">${stats.utilizationPercent}% (${stats.active}/${stats.total} Leased)</span>
                        </div>
                        <div class="utilization-track">
                            <div class="utilization-fill" style="width: ${stats.utilizationPercent}%"></div>
                        </div>
                    </div>

                    <!-- IP Grid Heatmap -->
                    <div class="ip-grid" id="ip-grid-cells"></div>

                    <!-- Selected IP Inspector / Action Drawer -->
                    <div class="ip-cell-drawer" id="ip-cell-drawer" style="display: none;">
                        <div class="drawer-header">
                            <span class="drawer-ip" id="drawer-ip-text">192.168.1.100</span>
                            <span class="drawer-status" id="drawer-status-pill">AVAILABLE</span>
                        </div>
                        <div class="drawer-body" id="drawer-body-text">
                            No active lease on this address.
                        </div>
                        <div class="drawer-actions" id="drawer-actions">
                            <button class="btn-sm btn-danger" id="drawer-inject-conflict-btn">Inject Conflict</button>
                            <button class="btn-sm btn-ghost" id="drawer-clear-quarantine-btn" style="display:none;">Clear Quarantine</button>
                        </div>
                    </div>
                </div>
            `;

            this.bindFilters();
            this.updateGrid();
        }

        bindFilters() {
            const filterBtns = this.container.querySelectorAll('.filter-chip');
            filterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.filterStatus = btn.getAttribute('data-filter');
                    this.updateGrid();
                });
            });

            const conflictBtn = this.container.querySelector('#drawer-inject-conflict-btn');
            if (conflictBtn) {
                conflictBtn.addEventListener('click', () => {
                    if (this.selectedIp && typeof this.onInjectConflict === 'function') {
                        this.onInjectConflict(this.selectedIp);
                    }
                });
            }

            const clearBtn = this.container.querySelector('#drawer-clear-quarantine-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    if (this.selectedIp && typeof this.onClearQuarantine === 'function') {
                        this.onClearQuarantine(this.selectedIp);
                    }
                });
            }
        }

        update() {
            const stats = this.server.updatePoolStatistics();
            const pctEl = this.container.querySelector('.utilization-pct');
            const fillEl = this.container.querySelector('.utilization-fill');
            if (pctEl) pctEl.innerText = `${stats.utilizationPercent}% (${stats.active}/${stats.total} Leased)`;
            if (fillEl) fillEl.style.width = `${stats.utilizationPercent}%`;

            this.updateGrid();
        }

        updateGrid() {
            const gridEl = this.container.querySelector('#ip-grid-cells');
            if (!gridEl) return;

            const entries = this.server.getPoolEntries();
            let filtered = entries;

            if (this.filterStatus !== 'ALL') {
                filtered = entries.filter(e => e.status === this.filterStatus);
            }

            gridEl.innerHTML = filtered.map(entry => {
                const octet = entry.ip.split('.')[3];
                const isSelected = entry.ip === this.selectedIp;
                let statusClass = `status-${entry.status.toLowerCase()}`;

                return `
                    <div class="ip-block ${statusClass} ${isSelected ? 'is-selected' : ''}" 
                         data-ip="${entry.ip}" 
                         title="${entry.ip} (${entry.status}) ${entry.clientHost ? '- ' + entry.clientHost : ''}">
                        <span class="ip-octet">.${octet}</span>
                        <span class="ip-status-dot"></span>
                        ${entry.clientHost ? `<span class="ip-host-tag">${entry.clientHost}</span>` : ''}
                    </div>
                `;
            }).join('');

            // Bind click to drawer
            gridEl.querySelectorAll('.ip-block').forEach(cell => {
                cell.addEventListener('click', () => {
                    const ip = cell.getAttribute('data-ip');
                    this.selectIp(ip);
                });
            });
        }

        selectIp(ip) {
            this.selectedIp = ip;
            const entries = this.server.getPoolEntries();
            const entry = entries.find(e => e.ip === ip);
            if (!entry) return;

            const drawer = this.container.querySelector('#ip-cell-drawer');
            const ipText = this.container.querySelector('#drawer-ip-text');
            const statusPill = this.container.querySelector('#drawer-status-pill');
            const bodyText = this.container.querySelector('#drawer-body-text');
            const conflictBtn = this.container.querySelector('#drawer-inject-conflict-btn');
            const clearBtn = this.container.querySelector('#drawer-clear-quarantine-btn');

            if (drawer) drawer.style.display = 'block';
            if (ipText) ipText.innerText = entry.ip;

            if (statusPill) {
                statusPill.className = `drawer-status status-${entry.status.toLowerCase()}`;
                statusPill.innerText = entry.status;
            }

            if (bodyText) {
                if (entry.status === 'BOUND') {
                    bodyText.innerHTML = `
                        <div><strong>Leased to:</strong> ${entry.clientHost || 'Client'} (<code>${entry.clientMac}</code>)</div>
                        <div><strong>Lease expires at:</strong> T+${entry.expiresAt}s (T1: T+${entry.t1At}s)</div>
                        <div><strong>Transaction ID:</strong> <code>${entry.xid || 'N/A'}</code></div>
                    `;
                } else if (entry.status === 'CONFLICTED') {
                    bodyText.innerHTML = `
                        <div class="text-danger"><strong>⚠ QUARANTINED ADDRESS COLLISION</strong></div>
                        <div><strong>Reason:</strong> ${entry.conflictReason || 'ARP Collision'}</div>
                        <div>Address taken out of DHCP circulation to prevent network collisions.</div>
                    `;
                } else if (entry.status === 'OFFERED') {
                    bodyText.innerHTML = `
                        <div><strong>Tentatively Offered to:</strong> ${entry.clientHost} (<code>${entry.clientMac}</code>)</div>
                        <div>Waiting for client DHCPREQUEST confirmation...</div>
                    `;
                } else {
                    bodyText.innerHTML = `<div>Available for automatic dynamic allocation.</div>`;
                }
            }

            if (conflictBtn) conflictBtn.style.display = entry.status !== 'CONFLICTED' ? 'inline-block' : 'none';
            if (clearBtn) clearBtn.style.display = entry.status === 'CONFLICTED' ? 'inline-block' : 'none';

            this.updateGrid();
        }
    }

    return IpMatrix;
}));

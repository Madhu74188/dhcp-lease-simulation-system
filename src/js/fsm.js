/**
 * Network Address Allocation and DHCP Lease Simulation System
 * Client DHCP Finite-State Machine (FSM) Module
 * 
 * Implements RFC 2131 State Transition Model for DHCP Lease Lifecycle:
 * INIT -> SELECTING -> REQUESTING -> BOUND -> RENEWING -> REBINDING -> EXPIRED / RELEASED / DECLINED
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DhcpFSM = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    /**
     * Complete RFC 2131 Lease States Definitions
     */
    const LEASE_STATES = {
        INIT: {
            id: 'INIT',
            name: 'INIT',
            label: 'Initial / Offline',
            color: '#64748b', // Slate
            accentColor: '#94a3b8',
            icon: 'power-off',
            description: 'Client interface unconfigured. No valid IP lease held.',
            rfcSection: 'RFC 2131 Section 4.4.1',
            allowedTransitions: ['SELECTING', 'REBOOTING', 'BOUND']
        },
        SELECTING: {
            id: 'SELECTING',
            name: 'SELECTING',
            label: 'Discover / Selecting',
            color: '#0284c7', // Sky Blue
            accentColor: '#38bdf8',
            icon: 'search',
            description: 'Sent DHCPDISCOVER. Collecting and evaluating DHCPOFFERs from servers.',
            rfcSection: 'RFC 2131 Section 4.4.1',
            allowedTransitions: ['REQUESTING', 'INIT']
        },
        REQUESTING: {
            id: 'REQUESTING',
            name: 'REQUESTING',
            label: 'Offer / Requesting',
            color: '#d97706', // Amber
            accentColor: '#fbbf24',
            icon: 'send',
            description: 'Selected an offer and broadcast DHCPREQUEST. Awaiting DHCPACK or DHCPNAK.',
            rfcSection: 'RFC 2131 Section 4.4.1',
            allowedTransitions: ['BOUND', 'INIT', 'DECLINED', 'SELECTING']
        },
        BOUND: {
            id: 'BOUND',
            name: 'BOUND',
            label: 'Bound (Active Lease)',
            color: '#059669', // Emerald Green
            accentColor: '#34d399',
            icon: 'check-circle',
            description: 'Received DHCPACK and verified IP. Lease active. Operating normally.',
            rfcSection: 'RFC 2131 Section 4.4.2',
            allowedTransitions: ['RENEWING', 'RELEASED', 'EXPIRED', 'DECLINED', 'INIT']
        },
        RENEWING: {
            id: 'RENEWING',
            name: 'RENEWING',
            label: 'Renewing (T1 Timer)',
            color: '#8b5cf6', // Violet
            accentColor: '#a78bfa',
            icon: 'refresh-cw',
            description: 'T1 timer (50% lease) expired. Unicasting DHCPREQUEST to renew lease.',
            rfcSection: 'RFC 2131 Section 4.4.5',
            allowedTransitions: ['BOUND', 'REBINDING', 'INIT']
        },
        REBINDING: {
            id: 'REBINDING',
            name: 'REBINDING',
            label: 'Rebinding (T2 Timer)',
            color: '#e11d48', // Rose / Bright Red-Pink
            accentColor: '#fb7185',
            icon: 'alert-triangle',
            description: 'T2 timer (87.5% lease) expired. Broadcasting DHCPREQUEST to any server.',
            rfcSection: 'RFC 2131 Section 4.4.5',
            allowedTransitions: ['BOUND', 'EXPIRED', 'INIT']
        },
        RELEASED: {
            id: 'RELEASED',
            name: 'RELEASED',
            label: 'Released',
            color: '#475569', // Gray
            accentColor: '#64748b',
            icon: 'unlock',
            description: 'Sent DHCPRELEASE. IP voluntarily surrendered back to pool.',
            rfcSection: 'RFC 2131 Section 4.4.6',
            allowedTransitions: ['INIT', 'SELECTING']
        },
        EXPIRED: {
            id: 'EXPIRED',
            name: 'EXPIRED',
            label: 'Lease Expired',
            color: '#dc2626', // Red
            accentColor: '#f87171',
            icon: 'clock',
            description: 'Lease duration elapsed without renewal ACK. Network access revoked.',
            rfcSection: 'RFC 2131 Section 4.4.5',
            allowedTransitions: ['INIT', 'SELECTING']
        },
        DECLINED: {
            id: 'DECLINED',
            name: 'DECLINED',
            label: 'Address Conflict (Declined)',
            color: '#b91c1c', // Dark Red
            accentColor: '#ef4444',
            icon: 'slash',
            description: 'Address collision detected via ARP probe. Sent DHCPDECLINE to quarantine IP.',
            rfcSection: 'RFC 2131 Section 4.4.1',
            allowedTransitions: ['INIT', 'SELECTING']
        }
    };

    /**
     * Transition Matrix & Event Triggers
     */
    const TRANSITIONS = [
        // INIT transitions
        { from: 'INIT', to: 'SELECTING', event: 'SEND_DISCOVER', desc: 'Client powers on / requests IP; sends DHCPDISCOVER' },
        { from: 'INIT', to: 'BOUND', event: 'MANUAL_STATIC_ASSIGN', desc: 'Manual static IP configured' },

        // SELECTING transitions
        { from: 'SELECTING', to: 'REQUESTING', event: 'RECEIVE_OFFER', desc: 'Received DHCPOFFER from server; sends DHCPREQUEST' },
        { from: 'SELECTING', to: 'INIT', event: 'TIMEOUT_NO_OFFER', desc: 'No offers received; backoff retry' },

        // REQUESTING transitions
        { from: 'REQUESTING', to: 'BOUND', event: 'RECEIVE_ACK', desc: 'Received DHCPACK; ARP probe verified clean IP' },
        { from: 'REQUESTING', to: 'DECLINED', event: 'CONFLICT_DETECTED', desc: 'ARP probe detected duplicate IP! Sent DHCPDECLINE' },
        { from: 'REQUESTING', to: 'INIT', event: 'RECEIVE_NAK', desc: 'Received DHCPNAK; server refused allocation' },
        { from: 'REQUESTING', to: 'SELECTING', event: 'REQUEST_TIMEOUT', desc: 'Request timed out; re-discovering' },

        // BOUND transitions
        { from: 'BOUND', to: 'RENEWING', event: 'TIMER_T1_EXPIRED', desc: 'T1 timer (50%) expired; unicasting DHCPREQUEST' },
        { from: 'BOUND', to: 'RELEASED', event: 'SEND_RELEASE', desc: 'Client gracefully released lease; sends DHCPRELEASE' },
        { from: 'BOUND', to: 'INIT', event: 'DISCONNECT', desc: 'Client interface disconnected' },
        { from: 'BOUND', to: 'DECLINED', event: 'ARP_COLLISION_LATE', desc: 'Conflicting ARP packet seen on wire' },

        // RENEWING transitions
        { from: 'RENEWING', to: 'BOUND', event: 'RENEW_ACK_RECEIVED', desc: 'Server ACKed renewal; lease reset to 100%' },
        { from: 'RENEWING', to: 'REBINDING', event: 'TIMER_T2_EXPIRED', desc: 'T1 renewal failed; T2 (87.5%) reached, broadcasting to all servers' },
        { from: 'RENEWING', to: 'INIT', event: 'RENEW_NAK_RECEIVED', desc: 'Server NAKed renewal request' },

        // REBINDING transitions
        { from: 'REBINDING', to: 'BOUND', event: 'REBIND_ACK_RECEIVED', desc: 'Secondary or primary server ACKed rebinding' },
        { from: 'REBINDING', to: 'EXPIRED', event: 'LEASE_EXPIRED', desc: '100% lease duration elapsed without ACK' },
        { from: 'REBINDING', to: 'INIT', event: 'REBIND_NAK_RECEIVED', desc: 'Server sent NAK during rebinding' },

        // TERMINAL / RESET transitions
        { from: 'RELEASED', to: 'INIT', event: 'RESET', desc: 'Ready for new address cycle' },
        { from: 'EXPIRED', to: 'INIT', event: 'RESET', desc: 'Ready for new address cycle' },
        { from: 'DECLINED', to: 'INIT', event: 'BACKOFF_COMPLETE', desc: 'Backoff timer elapsed, returning to INIT' }
    ];

    /**
     * Finite-State Machine Instance for a Client Device
     */
    class FiniteStateMachine {
        constructor(clientId, initialState = 'INIT', onStateChange = null) {
            this.clientId = clientId;
            this.currentState = initialState;
            this.previousState = null;
            this.stateEnteredAt = Date.now();
            this.onStateChange = onStateChange;

            this.history = [{
                from: null,
                to: initialState,
                event: 'INITIALIZE',
                timestamp: this.stateEnteredAt,
                simTime: 0,
                details: 'FSM initialized in ' + initialState
            }];
        }

        getState() {
            return this.currentState;
        }

        getStateMeta() {
            return LEASE_STATES[this.currentState] || LEASE_STATES.INIT;
        }

        isBound() {
            return this.currentState === 'BOUND' || this.currentState === 'RENEWING' || this.currentState === 'REBINDING';
        }

        canTransition(toState) {
            const currentDef = LEASE_STATES[this.currentState];
            return currentDef && currentDef.allowedTransitions.includes(toState);
        }

        transition(toState, event = 'MANUAL_TRIGGER', details = '', simTime = 0) {
            if (!LEASE_STATES[toState]) {
                throw new Error(`Unknown target state: ${toState}`);
            }

            const fromState = this.currentState;
            const now = Date.now();

            this.previousState = fromState;
            this.currentState = toState;
            this.stateEnteredAt = now;

            const record = {
                from: fromState,
                to: toState,
                event: event,
                timestamp: now,
                simTime: simTime,
                details: details || `Transition from ${fromState} to ${toState} via ${event}`
            };

            this.history.push(record);
            if (this.history.length > 50) {
                this.history.shift();
            }

            if (typeof this.onStateChange === 'function') {
                this.onStateChange(this.clientId, fromState, toState, record);
            }

            return record;
        }

        reset(simTime = 0) {
            return this.transition('INIT', 'RESET', 'Manual FSM reset to initial state', simTime);
        }
    }

    return {
        LEASE_STATES,
        TRANSITIONS,
        FiniteStateMachine
    };
}));

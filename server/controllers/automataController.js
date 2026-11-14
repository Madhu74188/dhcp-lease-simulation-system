/**
 * Finite Automata Engine & Formal Transition Table
 * Implements RFC 2131 Deterministic Finite Automaton (DFA) Specification
 */

const AUTOMATA_SPEC = {
    title: "RFC 2131 DHCP Client Lease State Machine Automata",
    formalDefinition: {
        states: ["INIT", "SELECTING", "REQUESTING", "BOUND", "RENEWING", "REBINDING", "RELEASED", "DECLINED", "EXPIRED"],
        initialState: "INIT",
        stableAcceptingState: "BOUND",
        inputsAlphabet: [
            "SEND_DISCOVER",
            "RECV_OFFER",
            "RECV_ACK",
            "RECV_NAK",
            "T1_EXPIRED",
            "T2_EXPIRED",
            "T3_EXPIRED",
            "ARP_CONFLICT",
            "SEND_RELEASE",
            "RESET"
        ]
    },
    transitionTable: [
        {
            currentState: "INIT",
            inputEvent: "SEND_DISCOVER",
            nextState: "SELECTING",
            guardCondition: "Client interface up, no lease",
            outputAction: "Broadcast DHCPDISCOVER (xid generated)"
        },
        {
            currentState: "SELECTING",
            inputEvent: "RECV_OFFER",
            nextState: "REQUESTING",
            guardCondition: "Offer received with matching xid",
            outputAction: "Broadcast DHCPREQUEST (Option 54 server ID)"
        },
        {
            currentState: "SELECTING",
            inputEvent: "TIMEOUT",
            nextState: "INIT",
            guardCondition: "No offer received within timeout",
            outputAction: "Exponential backoff retry"
        },
        {
            currentState: "REQUESTING",
            inputEvent: "RECV_ACK",
            nextState: "BOUND",
            guardCondition: "ACK received & ARP probe clean",
            outputAction: "Configure IP, Start T1/T2/T3 timers"
        },
        {
            currentState: "REQUESTING",
            inputEvent: "ARP_CONFLICT",
            nextState: "DECLINED",
            guardCondition: "ARP probe detects duplicate IP",
            outputAction: "Send DHCPDECLINE, quarantine IP"
        },
        {
            currentState: "REQUESTING",
            inputEvent: "RECV_NAK",
            nextState: "INIT",
            guardCondition: "Server refuses allocation (NAK)",
            outputAction: "Drop parameters, return to unassigned"
        },
        {
            currentState: "BOUND",
            inputEvent: "T1_EXPIRED",
            nextState: "RENEWING",
            guardCondition: "50% lease time reached",
            outputAction: "Unicast DHCPREQUEST to leasing server"
        },
        {
            currentState: "BOUND",
            inputEvent: "SEND_RELEASE",
            nextState: "RELEASED",
            guardCondition: "User disengages interface",
            outputAction: "Send DHCPRELEASE, clear IP"
        },
        {
            currentState: "RENEWING",
            inputEvent: "RECV_ACK",
            nextState: "BOUND",
            guardCondition: "Server ACK extends lease",
            outputAction: "Reset lease timer to 100%"
        },
        {
            currentState: "RENEWING",
            inputEvent: "T2_EXPIRED",
            nextState: "REBINDING",
            guardCondition: "87.5% lease reached without ACK",
            outputAction: "Broadcast DHCPREQUEST to any server"
        },
        {
            currentState: "REBINDING",
            inputEvent: "RECV_ACK",
            nextState: "BOUND",
            guardCondition: "Any server confirms lease",
            outputAction: "Reset lease timer to 100%"
        },
        {
            currentState: "REBINDING",
            inputEvent: "T3_EXPIRED",
            nextState: "EXPIRED",
            guardCondition: "100% lease elapsed without ACK",
            outputAction: "Revoke IP, disconnect network"
        },
        {
            currentState: "DECLINED",
            inputEvent: "RESET",
            nextState: "INIT",
            guardCondition: "Backoff timer elapsed",
            outputAction: "Prepare new discovery cycle"
        },
        {
            currentState: "RELEASED",
            inputEvent: "RESET",
            nextState: "INIT",
            guardCondition: "Immediate",
            outputAction: "Ready for new acquisition"
        },
        {
            currentState: "EXPIRED",
            inputEvent: "RESET",
            nextState: "INIT",
            guardCondition: "Immediate",
            outputAction: "Return to unconfigured"
        }
    ]
};

exports.getAutomataDetails = (req, res) => {
    res.json({
        success: true,
        data: AUTOMATA_SPEC
    });
};

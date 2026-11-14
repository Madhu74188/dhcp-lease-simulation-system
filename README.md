# NET-DHCP // Network Address Allocation and DHCP Lease Simulation System

An interactive, high-fidelity web application that simulates DHCP-based IP address allocation, Finite-State Machine (FSM) lease lifecycle management, regular expression address validation, live packet exchanges, address collisions (ARP probes & DHCPDECLINE), lease expiry/renewal, and pool exhaustion errors.

---

## 🌟 Key Features

1. **RFC 2131 Finite-State Machine (FSM) Visualizer**:
   - Interactive, animated SVG state transition graph.
   - States modeled: `INIT`, `SELECTING` (Discover), `REQUESTING` (Offer), `BOUND`, `RENEWING` (T1 50%), `REBINDING` (T2 87.5%), `RELEASED`, `EXPIRED`, and `DECLINED` (Conflict).
   - Real-time active state halo pulse, RFC specification drawer, and transition crumb trail.

2. **Strict Regular Expression Validation**:
   - **IPv4 Format**: `^(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$`
   - **IEEE 802 MAC**: `^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}$` (supports colon, hyphen, and Cisco dotted formats; detects multicast MACs).
   - **Contiguous Netmasks**: Validates RFC 950 / CIDR contiguous subnet masks.
   - **RFC 1123 Hostnames**: Strict label syntax validation.
   - **Interactive Regex Lab**: Live testbench with token-by-token syntactic breakdown, match tester, and error diagnostics.

3. **Message Exchange Sequence (Ladder) Diagram**:
   - Live UML ladder diagram illustrating packet exchanges between Client, Network Switch, and DHCP Server(s).
   - Color-coded protocol message badges (`DHCPDISCOVER`, `DHCPOFFER`, `DHCPREQUEST`, `DHCPACK`, `DHCPNAK`, `DHCPDECLINE`, `DHCPRELEASE`, `ARP PROBE`).
   - One-click navigation to inspect any message in the Packet Inspector.

4. **Deep Packet Inspector (RFC 2131 & RFC 2132)**:
   - Full decoding of Ethernet, IP, and UDP layers.
   - Fixed header fields: `op`, `htype`, `hlen`, `hops`, `xid`, `secs`, `flags`, `ciaddr`, `yiaddr`, `siaddr`, `giaddr`, `chaddr`.
   - Variable Options decoder: Option 53 (Message Type), Option 54 (Server ID), Option 51 (Lease Time), Option 58 (T1), Option 59 (T2), Option 1 (Subnet Mask), Option 3 (Router), Option 6 (DNS), Option 12 (Hostname).

5. **Address Conflict Simulation & Quarantine**:
   - Simulated Gratuitous ARP / ARP probe collision.
   - Client triggers `DHCPDECLINE` upon collision; Server locks that IP in quarantine and isolates it from dynamic pool allocation.

6. **Interactive IP Address Pool Heatmap**:
   - Visual grid of the entire address pool.
   - Live state indicators: Available, Bound, Offered, Conflicted, and Static.
   - Real-time pool utilization gauge.
   - Administrative controls: Manual Conflict Injection, Quarantine Clearing.

7. **Multi-Device Topology & Fault Injection**:
   - Add/Remove custom devices (Laptops, Phones, Workstations, IoT Sensors).
   - Live lease countdown timers with visual T1 (50%) and T2 (87.5%) threshold markers.
   - Rogue DHCP Server emulation: race condition between authorized server and rogue server on `10.0.0.1`.
   - Pool exhaustion and DHCPNAK generation.

---

## 🚀 How to Run

### Method 1: Instant Browser Launch (Zero Installation)
Double-click **`open_browser.bat`** or double-click **`standalone.html`** in Windows Explorer. It opens instantly in any web browser without needing a server or Node.js.

### Method 2: Launch via Local Node.js Server
Double-click **`start.bat`** or run:
```bash
npm start
```
Then navigate to `http://localhost:3000` in your browser.

### Method 3: Run the Automated Unit Test Suite
To verify the regular expressions, FSM state transitions, and pool allocations:
```bash
npm test
```

---

## 📁 Project Structure

```
dhcp-lease-simulation-system/
├── index.html                 # Main web application entry point
├── standalone.html            # Standalone zero-dependency bundle
├── server.js                  # Lightweight Node.js static HTTP server
├── package.json               # NPM scripts and configuration
├── start.bat                  # Windows batch launcher (Server + Browser)
├── open_browser.bat           # Windows direct browser launcher
├── build-standalone.js        # Build script for standalone bundle
├── README.md                  # Comprehensive documentation
├── src/
│   ├── css/
│   │   └── styles.css         # Modern NOC & Cyber-Modern UI stylesheet
│   └── js/
│       ├── regex-validator.js # IPv4, MAC, Mask, CIDR regex validators & explanations
│       ├── packet.js          # RFC 2131 DHCP packet data structures & factories
│       ├── fsm.js             # Client lease Finite-State Machine implementation
│       ├── dhcp-server.js     # DHCP server, address pool, leases & quarantine engine
│       ├── client.js          # Client device model with FSM & timer monitors
│       ├── simulation.js      # Simulation coordinator & scenario orchestrator
│       ├── app.js             # Application bootstrap
│       └── ui/
│           ├── fsm-visualizer.js    # Interactive SVG FSM diagram
│           ├── sequence-diagram.js  # Message exchange ladder diagram
│           ├── packet-inspector.js  # Deep RFC 2131 packet header decoder
│           ├── ip-matrix.js         # IP pool heatmap and utilization meter
│           ├── regex-lab.js         # Interactive regex tester & educational lab
│           └── ui-controller.js     # Master UI binding coordinator
└── test/
    └── test-fsm-regex.js      # 19 automated tests for regex and FSM logic
```

---

## 🔬 Protocol & FSM Reference

### The 4-Step DORA Handshake
```
Client                          Network Switch                     DHCP Server
  │                                    │                                 │
  ├────── DHCPDISCOVER (Broadcast) ───►│──────── DHCPDISCOVER ──────────►│
  │                                    │                                 │
  │◄───── DHCPOFFER (Unicast/Bcast) ───│◄─────── DHCPOFFER ──────────────┤
  │                                    │                                 │
  ├────── DHCPREQUEST (Broadcast) ────►│──────── DHCPREQUEST ───────────►│
  │                                    │                                 │
  │◄───── DHCPACK (Unicast/Bcast) ─────│◄─────── DHCPACK ────────────────┤
  │                                    │                                 │
[BOUND]                                                            [LEASE COMMITTED]
```

### Lease Timers
- **T1 (Renewal Timer)**: Set to 50% of lease duration (`0.50 * lease`). Client unicasts `DHCPREQUEST` directly to the leasing server.
- **T2 (Rebinding Timer)**: Set to 87.5% of lease duration (`0.875 * lease`). If T1 renewal was unacknowledged, client broadcasts `DHCPREQUEST` to any available server.
- **T3 (Lease Expiry)**: Set to 100% of lease duration. If no ACK is received by this time, client relinquishes the IP, transitions to `INIT`, and server reclaims the address.

---

## 📜 License
MIT License. Built for Computer Networks Education and Protocol Engineering.

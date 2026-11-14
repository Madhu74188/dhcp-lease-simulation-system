# Network Address Allocation and DHCP Lease Simulation System (Activity 2)

**Course:** CS3352 - Computer Networks Laboratory  
**Activity:** Activity 2  
**Student Name:** Madhuvarsh C  
**GitHub:** [https://github.com/Madhu74188/dhcp-lease-simulation-system](https://github.com/Madhu74188/dhcp-lease-simulation-system)  
**Live Application:** [https://madhu74188.github.io/dhcp-lease-simulation-system/](https://madhu74188.github.io/dhcp-lease-simulation-system/)

---

## 📌 Project Overview
This project simulates dynamic network address allocation and the DHCP lease lifecycle using a full **MERN Stack** (MongoDB, Express.js, React.js, Node.js) paired with formal **Automata Theory** (Deterministic Finite Automaton / FSM) and strict **Regular Expression Form Validation**.

The system fully covers RFC 2131 and RFC 2132 requirements:
1. **Dynamic IP Address Allocation (DORA)**: DHCPDISCOVER, DHCPOFFER, DHCPREQUEST, DHCPACK.
2. **Formal Automata (FSM / DFA)**: State Transition Diagram and Transition Table representing the lease lifecycle from `INIT` through `BOUND`, `RENEWING`, and `RELEASED`.
3. **Form & Address Validation**: Regular expressions validating IPv4 format (0-255 octets) and IEEE 802 MAC addresses (colon, hyphen, and dotted formats).
4. **Message Exchange Sequence**: Live ladder tracking packet directions and timestamps.
5. **Address Collision & Conflict Quarantine**: Detection via simulated ARP probe, triggering `DHCPDECLINE` and isolating conflicting addresses.
6. **Lease Expiration & Renewal**: Automatic T1 (50%) renewal and T2 (87.5%) rebinding countdowns.
7. **Pool Exhaustion Handling**: Detection of zero available addresses and emission of `DHCPNAK`.

---

## 📐 Automata Design: State Transition Diagram & Table

### 1. Formal 5-Tuple Definition: $M = (Q, \Sigma, \delta, q_0, F)$
- **$Q$ (States):** `{INIT, SELECTING (DISCOVER), REQUESTING (OFFER), BOUND, RENEWING, RELEASED, EXPIRED, DECLINED}`
- **$\Sigma$ (Alphabet / Inputs):** `{SEND_DISCOVER, RECV_OFFER, SEND_REQUEST, RECV_ACK, TIMEOUT_T1, TIMEOUT_LEASE, USER_RELEASE, ARP_COLLISION, RECV_NAK}`
- **$q_0$ (Initial State):** `INIT`
- **$F$ (Accepting / Stable States):** `{BOUND, RELEASED}`
- **$\delta$ (Transition Function):** Defined by the table below.

### 2. State Transition Table

| Current State | Input Event | Next State | Network Action / Protocol Packet |
| :--- | :--- | :--- | :--- |
| **INIT** | `SEND_DISCOVER` | **SELECTING (DISCOVER)** | Broadcasts `DHCPDISCOVER` on `255.255.255.255:67` |
| **SELECTING (DISCOVER)** | `RECV_OFFER` | **REQUESTING (OFFER)** | Receives `DHCPOFFER` from Server with proposed IP |
| **SELECTING (DISCOVER)** | `TIMEOUT` | **INIT** | Retries exponential backoff |
| **REQUESTING (OFFER)** | `SEND_REQUEST` | **REQUESTING (OFFER)** | Broadcasts `DHCPREQUEST` requesting the offered IP |
| **REQUESTING (OFFER)** | `RECV_ACK` | **BOUND** | Performs ARP probe; IP clean; starts lease timer |
| **REQUESTING (OFFER)** | `ARP_COLLISION` | **DECLINED** | Sends `DHCPDECLINE`; locks IP in Quarantine |
| **REQUESTING (OFFER)** | `RECV_NAK` | **INIT** | Pool empty or invalid lease; resets to INIT |
| **BOUND** | `TIMEOUT_T1` (50%) | **RENEWING** | Unicasts `DHCPREQUEST` to lease server |
| **BOUND** | `USER_RELEASE` | **RELEASED** | Sends `DHCPRELEASE`; IP returned to Available Pool |
| **BOUND** | `TIMEOUT_LEASE` | **EXPIRED** | Lease countdown reaches 0; IP reclaimed |
| **RENEWING** | `RECV_ACK` | **BOUND** | Resets lease countdown timer to 100% |
| **RENEWING** | `TIMEOUT_LEASE` | **EXPIRED** | Reclaims IP; client transitions back to INIT |
| **DECLINED** | `AUTO_RETRY` | **INIT** | Restarts DORA handshake for a clean address |
| **RELEASED** | `USER_CONNECT` | **INIT** | Device re-enters initial boot state |

---

## 💻 Tech Stack & Architecture

### Backend: Node.js, Express.js & MongoDB
- **`server/server.js`**: Express application connecting to MongoDB via Mongoose.
- **`server/models/`**:
  - `Device.js`: MAC address, hostname, device type, current IP, FSM state.
  - `Lease.js`: Allocated IP, MAC, lease start, expiration time, state.
  - `IpPool.js`: IP block, subnet, gateway, status (Available, Leased, Conflicted).
  - `PacketLog.js`: Protocol message history (op, xid, ciaddr, yiaddr, options).
- **`server/controllers/`**:
  - `dhcpController.js`: Full DORA allocation engine, conflict quarantine, lease management.
  - `automataController.js`: DFA transition matrix and state validation API.
- **`server/routes/dhcpRoutes.js`**: RESTful endpoints for client and server actions.

### Frontend: React.js
- **`client/src/App.jsx`**: Master dashboard coordinating state across components.
- **`client/src/components/DeviceControl.jsx`**: Device selector, lease timers, and DORA action triggers.
- **`client/src/components/FsmDiagram.jsx`**: Visual interactive State Transition Diagram.
- **`client/src/components/TransitionTable.jsx`**: Automata transition table with live active row highlighting.
- **`client/src/components/RegexValidatorCard.jsx`**: User input form validation for IPv4 and MAC with visual regex feedback.
- **`client/src/components/IpPoolGrid.jsx`**: Dynamic IP allocation matrix showing Leased, Available, and Conflicted states.
- **`client/src/components/MessageFeed.jsx`**: Chronological packet exchange log.

---

## 🚀 How to Run the Project

### Option 1: Instant Browser Launch (Zero Installation)
Double-click **`open_browser.bat`** or open **`standalone.html`** directly in any web browser.

### Option 2: Full MERN Stack
1. Start MongoDB (`mongod` or local MongoDB service).
2. Install dependencies:
   ```bash
   npm run install-all
   ```
3. Run Backend Server:
   ```bash
   npm run server
   ```
4. Run Frontend React Client:
   ```bash
   npm run client
   ```

### Option 3: Standard Node Static Server
```bash
npm start
```
Then visit `http://localhost:3000`.

### Option 4: Run Automated Tests
```bash
npm test
```
All 19 unit tests verify IPv4 Regex, MAC Regex, Subnet Regex, FSM transitions, and IP pool quarantine.

import React, { useState, useEffect } from 'react';
import DeviceControl from './components/DeviceControl';
import FsmDiagram from './components/FsmDiagram';
import TransitionTable from './components/TransitionTable';
import MessageFeed from './components/MessageFeed';
import IpPoolGrid from './components/IpPoolGrid';
import RegexValidatorCard from './components/RegexValidatorCard';

const INITIAL_DEVICES = [
  { deviceId: 'dev-1', hostname: 'Laptop-Alpha', macAddress: '00:1E:67:98:2A:1B', deviceType: 'laptop', assignedIp: '0.0.0.0', fsmState: 'INIT' },
  { deviceId: 'dev-2', hostname: 'iPhone-15', macAddress: 'F0:18:98:4C:55:02', deviceType: 'phone', assignedIp: '0.0.0.0', fsmState: 'INIT' },
  { deviceId: 'dev-3', hostname: 'Workstation-Pro', macAddress: '3C:D9:2B:11:80:A3', deviceType: 'workstation', assignedIp: '0.0.0.0', fsmState: 'INIT' },
  { deviceId: 'dev-4', hostname: 'IoT-SmartSensor', macAddress: 'B8:27:EB:44:9C:F4', deviceType: 'iot', assignedIp: '0.0.0.0', fsmState: 'INIT' }
];

const INITIAL_POOL = Array.from({ length: 21 }, (_, i) => ({
  ipAddress: `192.168.1.${100 + i}`,
  octet: 100 + i,
  status: 'AVAILABLE'
}));

const STATE_MESSAGES = {
  INIT: "Device interface unconfigured (IP: 0.0.0.0). Ready for DHCP discovery.",
  SELECTING: "Sent DHCPDISCOVER broadcast to 255.255.255.255. Evaluating DHCPOFFERs.",
  REQUESTING: "Accepted server offer. Broadcasting DHCPREQUEST to claim IP address.",
  BOUND: "Received DHCPACK! IP verified clean via ARP probe. Lease countdown active.",
  RENEWING: "50% lease elapsed (T1). Sending unicast DHCPREQUEST to extend lease duration.",
  REBINDING: "Server didn't answer renewal (T2). Broadcasting to all DHCP servers on network.",
  RELEASED: "Client gracefully surrendered its IP address back to the server pool.",
  DECLINED: "ARP probe detected duplicate IP! Sent DHCPDECLINE to quarantine address."
};

export default function App() {
  const [devices, setDevices] = useState(INITIAL_DEVICES);
  const [selectedDeviceId, setSelectedDeviceId] = useState('dev-1');
  const [ipPool, setIpPool] = useState(INITIAL_POOL);
  const [messages, setMessages] = useState([]);
  const [errorBanner, setErrorBanner] = useState(null);
  const [guideSpeech, setGuideSpeech] = useState(
    "Mam, this MERN web app simulates DHCP IP address allocation. Devices connect, go through the 4-step DORA handshake, follow an FSM state machine, and validate addresses with Regular Expressions."
  );

  const currentDev = devices.find(d => d.deviceId === selectedDeviceId) || devices[0];

  // 1. DORA HANDSHAKE
  const handleGetIp = (devId) => {
    setGuideSpeech("Mam, this demonstrates the 4-step DORA handshake: Discover, Offer, Request, and ACK. FSM moves from INIT ➔ DISCOVER ➔ OFFER ➔ BOUND.");
    
    // Find next available IP
    const availableIndex = ipPool.findIndex(p => p.status === 'AVAILABLE');
    if (availableIndex === -1) {
      setErrorBanner("Allocation Error: Address Pool Exhausted! No available IPs in pool.");
      setTimeout(() => setErrorBanner(null), 5000);
      return;
    }

    const freeIp = ipPool[availableIndex].ipAddress;

    // Update Pool
    const updatedPool = [...ipPool];
    updatedPool[availableIndex].status = 'BOUND';
    setIpPool(updatedPool);

    // Update Device
    setDevices(prev => prev.map(d => d.deviceId === devId ? { ...d, assignedIp: freeIp, fsmState: 'BOUND' } : d));

    // Add DORA Messages
    const newMsgs = [
      { type: 'DHCPDISCOVER', desc: `${currentDev.hostname} broadcast DHCPDISCOVER to 255.255.255.255`, time: 'T+0s' },
      { type: 'DHCPOFFER', desc: `DHCP Server offered ${freeIp} to ${currentDev.macAddress}`, time: 'T+1s' },
      { type: 'DHCPREQUEST', desc: `${currentDev.hostname} broadcast DHCPREQUEST accepting ${freeIp}`, time: 'T+2s' },
      { type: 'DHCPACK', desc: `Server acknowledged lease for ${freeIp} (Duration: 120s)`, time: 'T+3s' }
    ];
    setMessages(prev => [...newMsgs, ...prev]);
  };

  // 2. RENEW LEASE
  const handleRenew = (devId) => {
    if (currentDev.fsmState !== 'BOUND') {
      alert('Device must be BOUND to renew lease. Click "Get IP (DORA)" first.');
      return;
    }
    setGuideSpeech("Mam, this demonstrates T1 Renewal at 50% of lease time. The client sends a unicast DHCPREQUEST to extend its IP lease without disconnecting.");
    
    setDevices(prev => prev.map(d => d.deviceId === devId ? { ...d, fsmState: 'RENEWING' } : d));
    setTimeout(() => {
      setDevices(prev => prev.map(d => d.deviceId === devId ? { ...d, fsmState: 'BOUND' } : d));
      setMessages(prev => [{ type: 'DHCPACK', desc: `Server extended lease for ${currentDev.assignedIp} by 120s`, time: 'T+Now' }, ...prev]);
    }, 600);
  };

  // 3. RELEASE LEASE
  const handleRelease = (devId) => {
    if (currentDev.fsmState !== 'BOUND') return;
    setGuideSpeech("Mam, this demonstrates DHCPRELEASE. The device voluntarily surrenders its IP address back to the server pool and returns to INIT.");
    
    const releasedIp = currentDev.assignedIp;
    setIpPool(prev => prev.map(p => p.ipAddress === releasedIp ? { ...p, status: 'AVAILABLE' } : p));
    setDevices(prev => prev.map(d => d.deviceId === devId ? { ...d, assignedIp: '0.0.0.0', fsmState: 'RELEASED' } : d));
    setMessages(prev => [{ type: 'DHCPRELEASE', desc: `Client ${currentDev.hostname} relinquished IP ${releasedIp}`, time: 'T+Now' }, ...prev]);
  };

  // 4. TEST CONFLICT
  const handleConflict = (devId) => {
    setGuideSpeech("Mam, this demonstrates Address Conflict. An ARP probe detects a duplicate IP. The client triggers DHCPDECLINE, enters DECLINED, and the server quarantines the IP.");
    
    const conflictedIp = currentDev.assignedIp !== '0.0.0.0' ? currentDev.assignedIp : '192.168.1.100';
    setIpPool(prev => prev.map(p => p.ipAddress === conflictedIp ? { ...p, status: 'CONFLICTED' } : p));
    setDevices(prev => prev.map(d => d.deviceId === devId ? { ...d, assignedIp: '0.0.0.0', fsmState: 'DECLINED' } : d));
    setMessages(prev => [{ type: 'DHCPDECLINE', desc: `ARP Collision detected for ${conflictedIp}! Server quarantined IP`, time: 'T+Now' }, ...prev]);
  };

  // 5. RUN SCENARIO
  const runScenario = (scenario) => {
    if (scenario === 'dora') handleGetIp(selectedDeviceId);
    else if (scenario === 'conflict') handleConflict(selectedDeviceId);
    else if (scenario === 'pool') {
      setErrorBanner("Allocation Error: Address Pool Exhausted! All available IPs are in use.");
      setTimeout(() => setErrorBanner(null), 5000);
      setGuideSpeech("Mam, this demonstrates Allocation Error. When all pool IPs are leased, the server sends DHCPNAK to reject extra requests.");
    } else if (scenario === 'expiry') {
      handleRelease(selectedDeviceId);
      setGuideSpeech("Mam, this demonstrates Lease Expiry. The lease duration elapsed without renewal ACK, so the IP was reclaimed into the pool.");
    }
  };

  return (
    <div className="dashboard-container" style={{ padding: '20px' }}>
      {/* Top Header */}
      <header className="top-nav" style={{ borderRadius: '10px', marginBottom: '14px' }}>
        <div className="nav-brand">
          <span className="brand-badge">DHCP MERN</span>
          <div className="brand-text">
            <h1>Network Address Allocation & DHCP Lease Simulator</h1>
            <p>React + Node.js + Express.js + MongoDB + Automata FSM</p>
          </div>
        </div>

        {/* 1-Click Quick Scenarios */}
        <div className="quick-scenarios">
          <span className="scenario-title">1-Click Tests:</span>
          <button className="btn-scenario active" onClick={() => runScenario('dora')}>🟢 1. Normal DORA</button>
          <button className="btn-scenario" onClick={() => runScenario('conflict')}>🔴 2. IP Conflict (Decline)</button>
          <button className="btn-scenario" onClick={() => runScenario('expiry')}>⏱️ 3. Lease Expiry</button>
          <button className="btn-scenario" onClick={() => runScenario('pool')}>⚠️ 4. Pool Full (Error)</button>
        </div>
      </header>

      {/* Teacher Presentation Helper Banner */}
      <div className="presentation-guide-card">
        <div className="guide-icon">💬</div>
        <div className="guide-content">
          <div className="guide-title">EXPLANATION FOR MAM:</div>
          <div className="guide-text">"{guideSpeech}"</div>
        </div>
      </div>

      {/* Allocation Error Banner */}
      {errorBanner && (
        <div className="error-alert-banner show" style={{ marginTop: '10px' }}>
          <span>⚠️ <strong>{errorBanner}</strong></span>
          <span style={{ fontSize: '11px', opacity: 0.8 }}>Server cannot allocate an IP (DHCPNAK)</span>
        </div>
      )}

      {/* Top Half: Device Controls & State Machine */}
      <div className="dashboard-row" style={{ marginTop: '14px' }}>
        <DeviceControl
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={setSelectedDeviceId}
          onGetIp={handleGetIp}
          onRenew={handleRenew}
          onRelease={handleRelease}
          onConflict={handleConflict}
        />

        <FsmDiagram
          currentState={currentDev.fsmState}
          stateExplanation={STATE_MESSAGES[currentDev.fsmState] || STATE_MESSAGES.INIT}
        />
      </div>

      {/* Bottom Half: Messages, IP Pool, Regex Validator */}
      <div className="dashboard-row" style={{ gridTemplateColumns: '1.2fr 0.9fr 0.9fr', marginTop: '14px' }}>
        <MessageFeed messages={messages} />
        <IpPoolGrid pool={ipPool} />
        <RegexValidatorCard 
          currentIp={currentDev.assignedIp}
          currentMac={currentDev.macAddress}
        />
      </div>

      {/* Formal Automata State Transition Table */}
      <TransitionTable activeState={currentDev.fsmState} />
    </div>
  );
}

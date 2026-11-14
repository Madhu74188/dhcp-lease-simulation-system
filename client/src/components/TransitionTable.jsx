import React from 'react';

const TRANSITION_DATA = [
  { from: 'INIT', event: 'SEND_DISCOVER', to: 'SELECTING', guard: 'Interface Up, IP=0.0.0.0', action: 'Broadcast DHCPDISCOVER (xid generated)' },
  { from: 'SELECTING', event: 'RECV_OFFER', to: 'REQUESTING', guard: 'Offer received with matching xid', action: 'Broadcast DHCPREQUEST (Option 54 server ID)' },
  { from: 'SELECTING', event: 'TIMEOUT', to: 'INIT', guard: 'No offer within timeout', action: 'Exponential backoff retransmission' },
  { from: 'REQUESTING', event: 'RECV_ACK', to: 'BOUND', guard: 'ACK received & ARP probe clean', action: 'Configure IP, Start T1/T2/T3 Timers' },
  { from: 'REQUESTING', event: 'ARP_CONFLICT', to: 'DECLINED', guard: 'ARP probe detects duplicate IP', action: 'Send DHCPDECLINE, quarantine IP' },
  { from: 'REQUESTING', event: 'RECV_NAK', to: 'INIT', guard: 'Server refuses allocation', action: 'Clear parameters, return to unassigned' },
  { from: 'BOUND', event: 'T1_EXPIRED', to: 'RENEWING', guard: '50% lease duration elapsed', action: 'Unicast DHCPREQUEST to leasing server' },
  { from: 'BOUND', event: 'SEND_RELEASE', to: 'RELEASED', guard: 'User gracefully disengages', action: 'Send DHCPRELEASE, clear IP' },
  { from: 'RENEWING', event: 'RECV_ACK', to: 'BOUND', guard: 'Server ACK extends lease', action: 'Reset lease timer to 100%' },
  { from: 'RENEWING', event: 'T2_EXPIRED', to: 'REBINDING', guard: '87.5% lease reached without ACK', action: 'Broadcast DHCPREQUEST to any server' },
  { from: 'REBINDING', event: 'RECV_ACK', to: 'BOUND', guard: 'Any server confirms lease', action: 'Reset lease timer to 100%' },
  { from: 'REBINDING', event: 'T3_EXPIRED', to: 'EXPIRED', guard: '100% lease elapsed without ACK', action: 'Revoke IP address, cut connection' },
  { from: 'DECLINED', event: 'RESET', to: 'INIT', guard: 'Backoff timer elapsed', action: 'Prepare new acquisition cycle' },
  { from: 'RELEASED', event: 'RESET', to: 'INIT', guard: 'Immediate', action: 'Ready for new discovery' },
  { from: 'EXPIRED', event: 'RESET', to: 'INIT', guard: 'Immediate', action: 'Return to unconfigured' }
];

export default function TransitionTable({ activeState }) {
  return (
    <div className="clean-card" style={{ marginTop: '14px' }}>
      <div className="card-top">
        <span className="card-title">📋 Automata State Transition Table (RFC 2131)</span>
        <span style="font-size: 11px; color: var(--text-muted);">Formal Transition Matrix (δ: Q × Σ → Q)</span>
      </div>
      <div className="card-body" style={{ overflowX: 'auto', padding: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#0b1120', color: '#94a3b8', borderBottom: '1px solid #22324e' }}>
              <th style={{ padding: '8px 10px' }}>Current State (q)</th>
              <th style={{ padding: '8px 10px' }}>Input Event (σ)</th>
              <th style={{ padding: '8px 10px' }}>Next State (q')</th>
              <th style={{ padding: '8px 10px' }}>Guard Condition</th>
              <th style={{ padding: '8px 10px' }}>Output Action (λ)</th>
            </tr>
          </thead>
          <tbody>
            {TRANSITION_DATA.map((row, idx) => {
              const isHighlight = row.from === activeState || row.to === activeState;
              return (
                <tr 
                  key={idx}
                  style={{
                    borderBottom: '1px solid #1e293b',
                    background: isHighlight ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                    color: isHighlight ? '#38bdf8' : '#e2e8f0'
                  }}
                >
                  <td style={{ padding: '6px 10px', fontWeight: 700 }}>{row.from}</td>
                  <td style={{ padding: '6px 10px' }}><code>{row.event}</code></td>
                  <td style={{ padding: '6px 10px', fontWeight: 700 }}>{row.to}</td>
                  <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{row.guard}</td>
                  <td style={{ padding: '6px 10px' }}>{row.action}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

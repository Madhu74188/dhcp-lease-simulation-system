import React from 'react';

export default function MessageFeed({ messages }) {
  return (
    <div className="clean-card">
      <div className="card-top">
        <span className="card-title">📨 3. Message Exchanges (DORA)</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Live Packet Sequence Log</span>
      </div>
      <div className="card-body">
        <div className="seq-list-container">
          {messages.length === 0 ? (
            <div className="empty-hint">No messages yet. Click "Get IP (DORA)" to begin exchange.</div>
          ) : (
            messages.map((msg, idx) => {
              let badgeClass = 'seq-badge-discover';
              if (msg.type === 'DHCPOFFER') badgeClass = 'seq-badge-offer';
              else if (msg.type === 'DHCPREQUEST') badgeClass = 'seq-badge-request';
              else if (msg.type === 'DHCPACK') badgeClass = 'seq-badge-ack';
              else if (msg.type === 'DHCPDECLINE') badgeClass = 'seq-badge-decline';
              else if (msg.type === 'DHCPRELEASE') badgeClass = 'seq-badge-release';

              return (
                <div key={idx} className="seq-item">
                  <span className={`seq-item-badge ${badgeClass}`}>{msg.type}</span>
                  <span className="seq-item-desc">{msg.desc}</span>
                  <span className="seq-item-time">{msg.time || 'T+0s'}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

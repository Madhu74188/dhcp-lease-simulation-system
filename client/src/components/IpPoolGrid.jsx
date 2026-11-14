import React from 'react';

export default function IpPoolGrid({ pool }) {
  const activeCount = pool.filter(p => p.status === 'BOUND').length;
  const conflictedCount = pool.filter(p => p.status === 'CONFLICTED').length;
  const availableCount = pool.length - activeCount - conflictedCount;

  return (
    <div className="clean-card">
      <div className="card-top">
        <span className="card-title">▦ 4. IP Pool & Conflicts</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {activeCount} Leased / {availableCount} Available / {conflictedCount} Conflicted
        </span>
      </div>
      <div className="card-body">
        <div className="pool-heatmap-grid">
          {pool.map((entry) => {
            let statusClass = '';
            if (entry.status === 'BOUND') statusClass = 'active';
            else if (entry.status === 'CONFLICTED') statusClass = 'conflict';

            return (
              <div 
                key={entry.ipAddress} 
                className={`pool-dot ${statusClass}`}
                title={`${entry.ipAddress} (${entry.status})`}
              >
                .{entry.octet}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', justifyContent: 'center', marginTop: '4px' }}>
          <span>🟢 <strong style={{ color: '#4ade80' }}>Green:</strong> Bound</span>
          <span>⚪ <strong style={{ color: '#94a3b8' }}>Grey:</strong> Available</span>
          <span>🔴 <strong style={{ color: '#f87171' }}>Red:</strong> Conflict</span>
        </div>
      </div>
    </div>
  );
}

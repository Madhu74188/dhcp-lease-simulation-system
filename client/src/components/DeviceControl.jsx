import React from 'react';

export default function DeviceControl({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onGetIp,
  onRenew,
  onRelease,
  onConflict
}) {
  const currentDev = devices.find(d => d.deviceId === selectedDeviceId) || devices[0] || {};
  const isBound = currentDev.fsmState === 'BOUND';

  return (
    <div className="clean-card">
      <div className="card-top">
        <span className="card-title">💻 1. Client Devices & DHCP Allocation</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MERN Stack Client Manager</span>
      </div>
      <div className="card-body">
        {/* Device Selection Tabs */}
        <div className="device-select-bar">
          {devices.map((dev) => (
            <div
              key={dev.deviceId}
              className={`device-tab ${dev.deviceId === selectedDeviceId ? 'active' : ''}`}
              onClick={() => onSelectDevice(dev.deviceId)}
            >
              <span className={`device-tab-status ${dev.fsmState === 'BOUND' ? 'bound' : ''}`}></span>
              <span>{dev.hostname}</span>
            </div>
          ))}
        </div>

        {/* Device Status Box */}
        <div className="device-status-box">
          <div className="status-main-info">
            <div className="device-title-area">
              <h3>{currentDev.hostname}</h3>
              <div className="mac-badge">
                <span>MAC: <code>{currentDev.macAddress}</code></span>
                <span className="regex-tag-ok">✓ Regex Valid</span>
              </div>
            </div>
            <div className={`ip-display-pill ${isBound ? '' : 'unassigned'}`}>
              {currentDev.assignedIp !== '0.0.0.0' ? currentDev.assignedIp : '0.0.0.0 (Unassigned)'}
            </div>
          </div>

          {/* Lease Progress Meter */}
          <div className="lease-meter-container">
            <div className="lease-meter-label">
              <span>Lease Countdown (T1 = 50% Renewal Threshold)</span>
              <span>{isBound ? 'Active (120s duration)' : 'No active lease'}</span>
            </div>
            <div className="lease-track">
              <div 
                className="lease-fill" 
                style={{ width: isBound ? '85%' : '0%' }}
              ></div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons-grid">
          <button className="btn-dora" onClick={() => onGetIp(currentDev.deviceId)}>
            ▶ Get IP (DORA)
          </button>
          <button className="btn-secondary" onClick={() => onRenew(currentDev.deviceId)}>
            ⟳ Renew Lease
          </button>
          <button className="btn-secondary" onClick={() => onRelease(currentDev.deviceId)}>
            ⏏ Release IP
          </button>
          <button className="btn-warn" onClick={() => onConflict(currentDev.deviceId)}>
            ⚡ Test Conflict
          </button>
        </div>
      </div>
    </div>
  );
}

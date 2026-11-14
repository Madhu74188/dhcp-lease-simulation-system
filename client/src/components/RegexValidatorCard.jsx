import React, { useState } from 'react';

const IPV4_REGEX = /^(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/;
const MAC_REGEX = /^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}$/;

export default function RegexValidatorCard({ currentIp, currentMac }) {
  const [inputVal, setInputVal] = useState(currentIp && currentIp !== '0.0.0.0' ? currentIp : '192.168.1.100');

  const checkValidation = (val) => {
    const trimmed = val.trim();
    if (!trimmed) return { valid: false, message: 'Please enter an IP or MAC address to validate' };

    if (IPV4_REGEX.test(trimmed)) {
      const octets = trimmed.split('.').map(Number);
      if (octets[0] === 127) return { valid: false, message: '127.0.0.0/8 is reserved for Loopback' };
      if (octets[0] >= 224 && octets[0] <= 239) return { valid: false, message: '224.0.0.0/4 is reserved for Multicast' };
      return { valid: true, message: `RFC 791 IPv4 Valid: 4 decimal octets (0-255). 32-bit integer: ${(octets[0] << 24 | octets[1] << 16 | octets[2] << 8 | octets[3]) >>> 0}` };
    }

    if (MAC_REGEX.test(trimmed)) {
      return { valid: true, message: 'IEEE 802 MAC Address Valid: 48-bit hardware identifier' };
    }

    return { valid: false, message: 'Rejected by Regular Expression: Must be valid IPv4 (0-255 octets) or MAC (6 hex pairs)' };
  };

  const result = checkValidation(inputVal);

  return (
    <div className="clean-card">
      <div className="card-top">
        <span className="card-title">🔍 5. Regex Address Validator</span>
        <span style={{ fontSize: '11px', color: 'var(--color-blue)', fontWeight: 600 }}>Form Input Validation</span>
      </div>
      <div className="card-body">
        <div className="regex-box">
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
            User Input Validation (IPv4 & MAC format):
          </label>
          <div className="regex-input-row">
            <input 
              type="text" 
              className="clean-input" 
              value={inputVal} 
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="e.g. 192.168.1.100 or 00:1E:67:98:2A:1B"
            />
          </div>

          {/* Quick Test Shortcuts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
            <button className="btn-scenario" style={{ padding: '3px 8px', fontSize: '10px' }} onClick={() => setInputVal(currentIp || '192.168.1.100')}>
              📌 Current Device IP
            </button>
            <button className="btn-scenario" style={{ padding: '3px 8px', fontSize: '10px' }} onClick={() => setInputVal(currentMac || '00:1E:67:98:2A:1B')}>
              🏷️ Device MAC
            </button>
            <button className="btn-scenario" style={{ padding: '3px 8px', fontSize: '10px', color: '#f87171' }} onClick={() => setInputVal('192.168.1.300')}>
              ✗ Test Bad IP (300)
            </button>
            <button className="btn-scenario" style={{ padding: '3px 8px', fontSize: '10px', color: '#f87171' }} onClick={() => setInputVal('00:1E:67:98:2A:ZZ')}>
              ✗ Test Bad MAC
            </button>
          </div>

          <div className={`regex-result-pill ${result.valid ? 'res-valid' : 'res-invalid'}`}>
            {result.valid ? '✓ REGEX MATCH: VALID FORMAT' : '✗ REGEX REJECTED: INVALID FORMAT'}
          </div>

          <p className="regex-info-note">{result.message}</p>
        </div>
      </div>
    </div>
  );
}

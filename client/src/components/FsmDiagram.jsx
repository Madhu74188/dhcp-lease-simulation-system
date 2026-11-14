import React from 'react';

const FSM_STEPS = [
  { id: 'INIT', label: 'INIT', sub: 'Step 0' },
  { id: 'SELECTING', label: 'DISCOVER', sub: 'Step 1' },
  { id: 'REQUESTING', label: 'OFFER', sub: 'Step 2' },
  { id: 'BOUND', label: 'BOUND', sub: 'Step 3' },
  { id: 'RENEWING', label: 'RENEWING', sub: 'Step 4' },
  { id: 'RELEASED', label: 'RELEASED', sub: 'Final' }
];

export default function FsmDiagram({ currentState, stateExplanation }) {
  return (
    <div className="clean-card">
      <div className="card-top">
        <span className="card-title">🔄 2. Finite-State Machine (FSM) Lifecycle</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RFC 2131 Automata Diagram</span>
      </div>
      <div className="card-body">
        <div className="fsm-pipeline-container">
          
          {/* Active State Banner */}
          <div className="fsm-banner">
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>CURRENT STATE:</span>
              <span 
                className="fsm-state-badge" 
                style={{ 
                  background: currentState === 'BOUND' ? '#22c55e' : currentState === 'DECLINED' ? '#ef4444' : '#0284c7', 
                  color: '#fff' 
                }}
              >
                {currentState}
              </span>
            </div>
            <div style={{ textAlign: 'right', maxWidth: '65%' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', fontWeight: 700 }}>STATE EXPLANATION:</span>
              <p className="fsm-explain-text">{stateExplanation}</p>
            </div>
          </div>

          {/* Sequential Step Nodes */}
          <div className="fsm-nodes-track">
            {FSM_STEPS.map((step) => {
              const isActive = step.id === currentState;
              const isBound = step.id === 'BOUND' && currentState === 'BOUND';
              return (
                <div 
                  key={step.id} 
                  className={`fsm-step-node ${isActive ? 'is-active' : ''} ${isBound ? 'is-bound' : ''}`}
                >
                  <span className="node-num">{step.sub}</span>
                  <span className="node-name">{step.label}</span>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-dim)', textAlign: 'center' }}>
            DFA Lifecycle: <code>INIT</code> ➔ <code>DISCOVER</code> ➔ <code>OFFER</code> ➔ <code>REQUEST</code> ➔ <code>BOUND</code> ➔ <code>RENEWING</code> ➔ <code>RELEASED</code>
          </div>
        </div>
      </div>
    </div>
  );
}

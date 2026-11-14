/**
 * Network Address Allocation and DHCP Lease Simulation System
 * Regular Expression Validation Lab & Interactive Testbench
 * 
 * Provides an educational sandbox explaining the regex patterns used for IP, MAC,
 * and Subnet Mask verification, with live token breakdown and interactive tester.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['../regex-validator'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../regex-validator'));
    } else {
        root.RegexLab = factory(root.RegexValidator);
    }
}(typeof self !== 'undefined' ? self : this, function (RegexValidator) {

    class RegexLab {
        constructor(containerElement) {
            this.container = typeof containerElement === 'string' ? document.getElementById(containerElement) : containerElement;
            this.currentPatternKey = 'IPV4';
            this.testString = '192.168.1.100';

            if (this.container) {
                this.render();
            }
        }

        render() {
            const exp = RegexValidator.PATTERN_EXPLANATIONS[this.currentPatternKey];

            this.container.innerHTML = `
                <div class="regex-lab-card">
                    <div class="regex-header">
                        <div class="regex-title-group">
                            <h3 class="regex-title"><i class="icon-code"></i> Regular Expression Validation Lab</h3>
                            <span class="regex-subtitle">Interactive pattern inspector & input sanitization testbench</span>
                        </div>
                        <div class="regex-pattern-selector">
                            <button class="tab-btn ${this.currentPatternKey === 'IPV4' ? 'active' : ''}" data-key="IPV4">IPv4 Address</button>
                            <button class="tab-btn ${this.currentPatternKey === 'MAC' ? 'active' : ''}" data-key="MAC">MAC Address</button>
                            <button class="tab-btn ${this.currentPatternKey === 'SUBNET_MASK' ? 'active' : ''}" data-key="SUBNET_MASK">Subnet Mask</button>
                            <button class="tab-btn ${this.currentPatternKey === 'CIDR' ? 'active' : ''}" data-key="CIDR">CIDR Prefix</button>
                            <button class="tab-btn ${this.currentPatternKey === 'HOSTNAME' ? 'active' : ''}" data-key="HOSTNAME">RFC Hostname</button>
                        </div>
                    </div>

                    <!-- Active Pattern Definition & RFC Reference -->
                    <div class="regex-formula-box">
                        <div class="formula-meta">
                            <span class="pattern-name">${exp.name}</span>
                            <span class="pattern-rfc">${exp.rfc}</span>
                        </div>
                        <pre class="regex-code-block"><code>/${exp.pattern}/</code></pre>
                    </div>

                    <!-- Interactive Live Tester -->
                    <div class="regex-tester-section">
                        <label class="tester-label">Live String Tester:</label>
                        <div class="tester-input-row">
                            <input type="text" class="regex-input" id="regex-test-input" value="${this.testString}" placeholder="Enter test string..." />
                            <div class="tester-badge" id="regex-match-badge">Testing...</div>
                        </div>
                        <div class="regex-presets">
                            <span class="presets-label">Quick Test Presets:</span>
                            <span class="preset-links" id="regex-presets-list">
                                ${exp.examplesValid.map(ex => `<button class="chip-preset chip-valid" data-val="${ex}">✓ ${ex}</button>`).join('')}
                                ${exp.examplesInvalid.map(ex => `<button class="chip-preset chip-invalid" data-val="${ex}">✗ ${ex}</button>`).join('')}
                            </span>
                        </div>
                        <div class="regex-feedback-box" id="regex-feedback-box"></div>
                    </div>

                    <!-- Token Breakdown Table -->
                    <div class="regex-breakdown-section">
                        <h4 class="breakdown-title">Pattern Tokens & Quantifier Breakdown</h4>
                        <table class="breakdown-table">
                            <thead>
                                <tr>
                                    <th>Token / Subpattern</th>
                                    <th>Syntactic Meaning & Rule</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${exp.breakdown.map(b => `
                                    <tr>
                                        <td><code>${b.token}</code></td>
                                        <td>${b.desc}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            this.bindEvents();
            this.runLiveTest();
        }

        bindEvents() {
            // Pattern Tab Switching
            const tabs = this.container.querySelectorAll('.tab-btn');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    this.currentPatternKey = tab.getAttribute('data-key');
                    const exp = RegexValidator.PATTERN_EXPLANATIONS[this.currentPatternKey];
                    this.testString = exp.examplesValid[0] || '';
                    this.render();
                });
            });

            // Live Input
            const input = this.container.querySelector('#regex-test-input');
            if (input) {
                input.addEventListener('input', (e) => {
                    this.testString = e.target.value;
                    this.runLiveTest();
                });
            }

            // Presets
            const presets = this.container.querySelectorAll('.chip-preset');
            presets.forEach(p => {
                p.addEventListener('click', () => {
                    const val = p.getAttribute('data-val');
                    this.testString = val;
                    if (input) input.value = val;
                    this.runLiveTest();
                });
            });
        }

        runLiveTest() {
            const badge = this.container.querySelector('#regex-match-badge');
            const feedback = this.container.querySelector('#regex-feedback-box');
            if (!badge || !feedback) return;

            const inputVal = this.testString.trim();
            let isMatch = false;
            let detailedResult = null;

            if (this.currentPatternKey === 'IPV4') {
                isMatch = RegexValidator.validateIpv4(inputVal);
                detailedResult = RegexValidator.verifyIpAddress(inputVal);
            } else if (this.currentPatternKey === 'MAC') {
                isMatch = RegexValidator.validateMac(inputVal);
                detailedResult = RegexValidator.verifyMacAddress(inputVal);
            } else if (this.currentPatternKey === 'SUBNET_MASK') {
                isMatch = RegexValidator.validateSubnetMask(inputVal);
                detailedResult = { valid: isMatch, error: isMatch ? null : 'Not a valid contiguous IPv4 netmask' };
            } else if (this.currentPatternKey === 'CIDR') {
                isMatch = RegexValidator.validateCidr(inputVal);
                detailedResult = { valid: isMatch, error: isMatch ? null : 'Invalid CIDR format (expected IP/prefix)' };
            } else if (this.currentPatternKey === 'HOSTNAME') {
                isMatch = RegexValidator.validateHostname(inputVal);
                detailedResult = { valid: isMatch, error: isMatch ? null : 'Invalid RFC 1123 hostname format' };
            }

            if (isMatch && (!detailedResult || detailedResult.valid)) {
                badge.className = 'tester-badge badge-matched';
                badge.innerText = 'MATCH: VALID FORMAT';
                feedback.className = 'regex-feedback-box feedback-success';
                let extra = '';
                if (detailedResult && detailedResult.normalized) {
                    extra = `<div>Normalized Output: <code>${detailedResult.normalized}</code></div>`;
                }
                feedback.innerHTML = `<div>✓ Input strictly satisfies regular expression pattern.</div>${extra}`;
            } else {
                badge.className = 'tester-badge badge-unmatched';
                badge.innerText = 'NO MATCH: REJECTED';
                feedback.className = 'regex-feedback-box feedback-error';
                const reason = (detailedResult && detailedResult.error) ? detailedResult.error : 'String failed regular expression pattern test';
                feedback.innerHTML = `<div>✗ <strong>Validation Error:</strong> ${reason}</div>`;
            }
        }
    }

    return RegexLab;
}));

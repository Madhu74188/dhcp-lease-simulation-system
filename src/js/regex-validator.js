/**
 * Network Address Allocation and DHCP Lease Simulation System
 * Regular Expression Validation Module
 * 
 * Provides rigorous RFC-compliant regular expressions and validation utilities
 * for IPv4 addresses, MAC addresses (IEEE 802), Subnet Masks, CIDR prefixes, and Hostnames.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.RegexValidator = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    /**
     * Core Regular Expressions
     */
    const PATTERNS = {
        // Strict IPv4: 4 octets separated by dots, each 0-255, no leading zeros unless single '0'
        IPV4: /^(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$/,

        // MAC Address: 6 pairs of hex digits separated by colons or hyphens, or 3 groups of 4 hex digits (Cisco)
        MAC_COLON: /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/,
        MAC_HYPHEN: /^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/,
        MAC_CISCO: /^[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}$/,
        MAC_UNIFIED: /^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}\.[0-9A-Fa-f]{4}$/,

        // Subnet Mask: Valid contiguous IPv4 netmask (/8 to /30)
        SUBNET_MASK: /^(255\.(255\.(255\.(0|128|192|224|240|248|252|254|255)|(0|128|192|224|240|248|252|254|255)\.0)|(0|128|192|224|240|248|252|254|255)\.0\.0)|(0|128|192|224|240|248|252|254|255)\.0\.0\.0)$/,

        // CIDR Notation: IPv4 followed by / prefix between 1 and 32
        CIDR: /^(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}\/(?:[1-9]|[12][0-9]|3[0-2])$/,

        // RFC 1123 Hostname: 1-63 alphanumeric characters per label, hyphens allowed, total max 253
        HOSTNAME: /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

        // Hex Transaction ID (xid): 8 hexadecimal characters (32-bit uint in hex)
        HEX_XID: /^0x[0-9A-Fa-f]{8}$|^[0-9A-Fa-f]{8}$/
    };

    /**
     * Pattern Explanations for the interactive Regex Lab & UI tooltips
     */
    const PATTERN_EXPLANATIONS = {
        IPV4: {
            name: "IPv4 Address",
            pattern: "^(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$",
            rfc: "RFC 791 / RFC 1166",
            breakdown: [
                { token: "^ ... $", desc: "Anchors match to entire input string from start to finish" },
                { token: "25[0-5]", desc: "Matches numbers in range 250 - 255" },
                { token: "2[0-4][0-9]", desc: "Matches numbers in range 200 - 249" },
                { token: "1[0-9]{2}", desc: "Matches numbers in range 100 - 199" },
                { token: "[1-9]?[0-9]", desc: "Matches numbers in range 0 - 99 without leading zero (except '0')" },
                { token: "(?:\\....){3}", desc: "Repeats the dot followed by 0-255 octet exactly 3 times" }
            ],
            examplesValid: ["192.168.1.1", "10.0.0.254", "172.16.50.100", "0.0.0.0", "255.255.255.255"],
            examplesInvalid: ["192.168.1.256", "10.0.0.01", "172.300.1.1", "192.168.1", "192.168.1.1.1"]
        },
        MAC: {
            name: "MAC Address (IEEE 802)",
            pattern: "^(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$|^[0-9A-Fa-f]{4}\\.[0-9A-Fa-f]{4}\\.[0-9A-Fa-f]{4}$",
            rfc: "IEEE Std 802-2014",
            breakdown: [
                { token: "[0-9A-Fa-f]{2}", desc: "Matches 2 hexadecimal digits (one byte / octet)" },
                { token: "[:-]", desc: "Matches either a colon ':' (standard) or hyphen '-' (Windows) separator" },
                { token: "{5}", desc: "Repeats the byte-separator pattern 5 times" },
                { token: "|", desc: "Alternation operator: permits Cisco 3-group dotted format (e.g. 001a.2b3c.4d5e)" }
            ],
            examplesValid: ["00:1A:2B:3C:4D:5E", "52-54-00-12-34-56", "001A.2B3C.4D5E", "aa:bb:cc:dd:ee:ff"],
            examplesInvalid: ["00:1A:2B:3C:4D", "00:1A:2B:3C:4D:5G", "001A-2B3C-4D5E", "00:1A:2B:3C:4D:5E:6F"]
        },
        SUBNET_MASK: {
            name: "Subnet Mask (Contiguous)",
            pattern: "^(255\\.(255\\.(255\\.(0|128|192|224|240|248|252|254|255)|(0|128|192|224|240|248|252|254|255)\\.0)|(0|128|192|224|240|248|252|254|255)\\.0\\.0)|(0|128|192|224|240|248|252|254|255)\\.0\\.0\\.0)$",
            rfc: "RFC 950 / RFC 1519 (CIDR)",
            breakdown: [
                { token: "255\\.", desc: "Leading octets must be full 1-bits (255)" },
                { token: "(0|128|...|255)", desc: "Transition octet must have contiguous high-order 1-bits" },
                { token: "\\.0", desc: "All trailing octets after transition must be pure zeros" }
            ],
            examplesValid: ["255.255.255.0", "255.255.0.0", "255.0.0.0", "255.255.255.192", "255.255.254.0"],
            examplesInvalid: ["255.255.255.1", "255.255.0.255", "255.240.255.0", "256.255.255.0"]
        },
        CIDR: {
            name: "CIDR Prefix",
            pattern: "^(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(?:\\.(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}\\/(?:[1-9]|[12][0-9]|3[0-2])$",
            rfc: "RFC 4632",
            breakdown: [
                { token: "IPv4", desc: "Valid IPv4 address as network identifier" },
                { token: "\\/", desc: "Slash separator" },
                { token: "[1-9]|[12][0-9]|3[0-2]", desc: "Prefix length between 1 and 32" }
            ],
            examplesValid: ["192.168.1.0/24", "10.0.0.0/8", "172.16.0.0/16", "192.168.1.128/25"],
            examplesInvalid: ["192.168.1.0/33", "192.168.1.0/0", "192.168.1.256/24", "192.168.1.0"]
        },
        HOSTNAME: {
            name: "RFC 1123 Hostname",
            pattern: "^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$",
            rfc: "RFC 952 / RFC 1123",
            breakdown: [
                { token: "^[a-zA-Z0-9]", desc: "Label must begin with an alphanumeric character" },
                { token: "[a-zA-Z0-9-]{0,61}", desc: "Label body may contain letters, numbers, and hyphens (up to 63 chars total)" },
                { token: "[a-zA-Z0-9]$", desc: "Label must not end with a hyphen" },
                { token: "(\\....)*", desc: "Allows dot-separated domain labels" }
            ],
            examplesValid: ["laptop-alpha", "node-01.local", "server-dhcp", "host1", "iot-temp-sensor"],
            examplesInvalid: ["-laptop", "laptop-", "node..local", "host_name", "host@name"]
        }
    };

    /**
     * IP and Network Math Utility Functions
     */
    function ipToInt(ip) {
        if (!PATTERNS.IPV4.test(ip)) return null;
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    }

    function intToIp(intVal) {
        return [
            (intVal >>> 24) & 255,
            (intVal >>> 16) & 255,
            (intVal >>> 8) & 255,
            intVal & 255
        ].join('.');
    }

    function maskToCidr(mask) {
        if (!PATTERNS.SUBNET_MASK.test(mask)) return null;
        const intVal = ipToInt(mask);
        let count = 0;
        let bits = intVal;
        while (bits) {
            count += bits & 1;
            bits >>>= 1;
        }
        return count;
    }

    function cidrToMask(cidr) {
        if (cidr < 0 || cidr > 32) return null;
        if (cidr === 0) return '0.0.0.0';
        const maskInt = (0xFFFFFFFF << (32 - cidr)) >>> 0;
        return intToIp(maskInt);
    }

    function getNetworkAddress(ip, mask) {
        const ipInt = ipToInt(ip);
        const maskInt = ipToInt(mask);
        if (ipInt === null || maskInt === null) return null;
        return intToIp((ipInt & maskInt) >>> 0);
    }

    function getBroadcastAddress(ip, mask) {
        const ipInt = ipToInt(ip);
        const maskInt = ipToInt(mask);
        if (ipInt === null || maskInt === null) return null;
        return intToIp((ipInt | (~maskInt >>> 0)) >>> 0);
    }

    function isIpInSubnet(ip, subnetIp, mask) {
        const ipInt = ipToInt(ip);
        const subnetInt = ipToInt(subnetIp);
        const maskInt = ipToInt(mask);
        if (ipInt === null || subnetInt === null || maskInt === null) return false;
        return ((ipInt & maskInt) >>> 0) === ((subnetInt & maskInt) >>> 0);
    }

    function normalizeMac(mac) {
        if (!PATTERNS.MAC_UNIFIED.test(mac)) return null;
        // Clean separators and format as uppercase colon-separated XX:XX:XX:XX:XX:XX
        const clean = mac.replace(/[:-]/g, '').replace(/\./g, '').toUpperCase();
        if (clean.length !== 12) return null;
        return clean.match(/.{1,2}/g).join(':');
    }

    function isMulticastMac(mac) {
        const norm = normalizeMac(mac);
        if (!norm) return false;
        const firstByte = parseInt(norm.substring(0, 2), 16);
        return (firstByte & 0x01) === 1;
    }

    /**
     * Comprehensive Validation API
     */
    return {
        PATTERNS,
        PATTERN_EXPLANATIONS,

        // Core Validators returning boolean
        validateIpv4(ip) {
            return PATTERNS.IPV4.test(String(ip).trim());
        },

        validateMac(mac) {
            return PATTERNS.MAC_UNIFIED.test(String(mac).trim());
        },

        validateSubnetMask(mask) {
            return PATTERNS.SUBNET_MASK.test(String(mask).trim());
        },

        validateCidr(cidr) {
            return PATTERNS.CIDR.test(String(cidr).trim());
        },

        validateHostname(hostname) {
            return PATTERNS.HOSTNAME.test(String(hostname).trim());
        },

        validateHexXid(xid) {
            return PATTERNS.HEX_XID.test(String(xid).trim());
        },

        // Detailed Validators with error diagnostics
        verifyIpAddress(ip, subnet = null, mask = null) {
            const trimmed = String(ip || '').trim();
            if (!trimmed) {
                return { valid: false, error: "IP address cannot be empty" };
            }
            if (!PATTERNS.IPV4.test(trimmed)) {
                return { valid: false, error: "Invalid IPv4 format. Expected 4 decimal octets (0-255) separated by dots." };
            }

            const ipInt = ipToInt(trimmed);
            const firstOctet = parseInt(trimmed.split('.')[0], 10);

            if (firstOctet === 127) {
                return { valid: false, error: "Loopback address (127.0.0.0/8) cannot be assigned by DHCP", isSpecial: true };
            }
            if (firstOctet >= 224 && firstOctet <= 239) {
                return { valid: false, error: "Multicast address (Class D: 224.0.0.0/4) cannot be assigned to hosts", isSpecial: true };
            }
            if (firstOctet >= 240) {
                return { valid: false, error: "Reserved address (Class E: 240.0.0.0/4) cannot be assigned", isSpecial: true };
            }
            if (trimmed === '0.0.0.0') {
                return { valid: false, error: "0.0.0.0 is an unconfigured broadcast source, not assignable as client lease", isSpecial: true };
            }

            if (subnet && mask && PATTERNS.SUBNET_MASK.test(mask)) {
                const netAddr = getNetworkAddress(subnet, mask);
                const bcastAddr = getBroadcastAddress(subnet, mask);

                if (!isIpInSubnet(trimmed, subnet, mask)) {
                    return { valid: false, error: `IP ${trimmed} is outside the configured subnet ${netAddr}/${maskToCidr(mask)}` };
                }
                if (trimmed === netAddr) {
                    return { valid: false, error: `IP ${trimmed} is the network identifier address and cannot be leased` };
                }
                if (trimmed === bcastAddr) {
                    return { valid: false, error: `IP ${trimmed} is the directed broadcast address and cannot be leased` };
                }
            }

            return { valid: true, error: null, normalized: trimmed, integer: ipInt };
        },

        verifyMacAddress(mac) {
            const trimmed = String(mac || '').trim();
            if (!trimmed) {
                return { valid: false, error: "MAC address cannot be empty" };
            }
            if (!PATTERNS.MAC_UNIFIED.test(trimmed)) {
                return { 
                    valid: false, 
                    error: "Invalid MAC format. Expected 6 hex pairs (e.g. 00:1A:2B:3C:4D:5E or 00-1A-2B-3C-4D-5E) or Cisco format (001a.2b3c.4d5e)" 
                };
            }

            const normalized = normalizeMac(trimmed);
            if (isMulticastMac(trimmed)) {
                return { 
                    valid: false, 
                    error: `MAC ${normalized} has multicast/broadcast bit set (least significant bit of first octet is 1). DHCP requires unicast client hardware address.` 
                };
            }

            return { valid: true, error: null, normalized };
        },

        // Network calculation helpers
        ipToInt,
        intToIp,
        maskToCidr,
        cidrToMask,
        getNetworkAddress,
        getBroadcastAddress,
        isIpInSubnet,
        normalizeMac,
        isMulticastMac
    };
}));

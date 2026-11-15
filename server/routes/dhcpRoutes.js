/**
 * Express Router: DHCP Endpoints
 */
const express = require('express');
const router = express.Router();
const dhcpController = require('../controllers/dhcpController');
const automataController = require('../controllers/automataController');

// Devices
router.get('/devices', dhcpController.getDevices);
router.post('/devices', dhcpController.addDevice);

// IP Pool
router.get('/pool', dhcpController.getIpPool);

// DORA & Operations
router.post('/dora', dhcpController.triggerDora);
router.post('/conflict', dhcpController.triggerConflict);
router.post('/release', dhcpController.releaseLease);
router.post('/sync', dhcpController.syncLease);

// Automata & Transition Table
router.get('/automata', automataController.getAutomataDetails);

module.exports = router;

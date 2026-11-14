@echo off
title NET-DHCP // Simulation Server Launcher
echo ======================================================
echo NET-DHCP // Network Address Allocation & Lease Simulator
echo ======================================================
echo Starting local web server on http://localhost:3000 ...
echo.

start "" "http://localhost:3000"
node server.js
pause

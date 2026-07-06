// backend/utils/keepAlive.js
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000';
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (Render sleeps after ~15 min)

let intervalId = null;

/**
 * Start sending keep-alive pings to prevent Render from sleeping
 */
exports.startKeepAlive = () => {
  if (intervalId) {
    console.log('[KeepAlive] Already running');
    return;
  }

  console.log(`[KeepAlive] Starting pings to ${API_URL} every ${INTERVAL_MS / 60000} minutes`);

  intervalId = setInterval(async () => {
    try {
      const start = Date.now();
      const response = await axios.get(`${API_URL}/api/health`, {
        timeout: 15000,
        headers: { 'x-keep-alive': 'true' }
      });
      const duration = Date.now() - start;
      console.log(`[KeepAlive] Ping OK (${duration}ms) — Status: ${response.status}`);
    } catch (error) {
      console.error('[KeepAlive] Ping failed:', error.message);
    }
  }, INTERVAL_MS);
};

/**
 * Stop keep-alive pings
 */
exports.stopKeepAlive = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[KeepAlive] Stopped');
  }
};
// backend/routes/healthRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * GET /api/health
 * Lightweight health check — no DB query to keep it fast
 * Used by keep-alive pings and external uptime monitors
 */
router.get('/health', (req, res) => {
  const isKeepAlive = req.headers['x-keep-alive'] === 'true';
  
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dbConnected: mongoose.connection.readyState === 1,
    isKeepAlive: isKeepAlive,
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/health/deep
 * Deep health check — verifies DB is actually responsive
 * Use this for status pages, not for keep-alive pings
 */
router.get('/health/deep', async (req, res) => {
  try {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    const dbLatency = Date.now() - start;

    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dbConnected: true,
      dbLatencyMs: dbLatency,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      dbConnected: false,
      error: error.message
    });
  }
});

module.exports = router;

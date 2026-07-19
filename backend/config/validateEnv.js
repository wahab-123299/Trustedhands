/**
 * Environment Variable Validation
 * Runs at startup — crashes fast if required vars are missing/invalid
 * Prevents production deploys with broken config
 */

const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MONGODB_URI',
  'FRONTEND_URL',
];

const validateEnv = () => {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const key of requiredEnvVars) {
    if (!process.env[key] || process.env[key].trim() === '') {
      missing.push(key);
    }
  }

  // Check for default/fallback secrets (security risk)
  const dangerousDefaults = [
    { key: 'JWT_SECRET', badValues: ['your-secret-key', 'secret', 'jwt-secret', 'default', 'changeme'] },
    { key: 'JWT_REFRESH_SECRET', badValues: ['your-refresh-secret-key', 'refresh-secret', 'default'] },
    { key: 'COOKIE_SECRET', badValues: ['default-secret-change-in-production', 'cookie-secret', 'default'] },
  ];

  for (const { key, badValues } of dangerousDefaults) {
    const value = process.env[key];
    if (value && badValues.some(bad => value.toLowerCase().includes(bad.toLowerCase()))) {
      warnings.push(`⚠️  ${key} appears to use a default/weak value: "${value}"`);
    }
  }

  // Validate FRONTEND_URL format
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    try {
      new URL(frontendUrl);
      if (!frontendUrl.startsWith('https://') && process.env.NODE_ENV === 'production') {
        warnings.push(`⚠️  FRONTEND_URL should use HTTPS in production: ${frontendUrl}`);
      }
    } catch {
      warnings.push(`⚠️  FRONTEND_URL is not a valid URL: ${frontendUrl}`);
    }
  }

  // Validate JWT_SECRET length
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    warnings.push(`⚠️  JWT_SECRET should be at least 32 characters (current: ${jwtSecret.length})`);
  }

  // Validate MONGODB_URI has database name
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    // Check if URI ends with /databaseName or contains /databaseName?
    const hasDbName = /\/[^/?]+(\?|$)/.test(mongoUri.replace(/\/(\w+):\w+@/, '')); // strip credentials
    if (!hasDbName) {
      warnings.push(`⚠️  MONGODB_URI may be missing a database name (connects to 'test' by default)`);
    }
  }

  // Print results
  if (missing.length > 0) {
    console.error('\n❌ MISSING REQUIRED ENVIRONMENT VARIABLES:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n🛑 Server cannot start. Please set these variables in your .env file or hosting platform.\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  ENVIRONMENT WARNINGS:');
    warnings.forEach(w => console.warn(`   ${w}`));
    console.warn('\n');
  }

  // Log loaded config (without secrets)
  console.log('✅ Environment validated successfully');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL}`);
  console.log(`   PORT: ${process.env.PORT || '10000'}`);
  console.log(`   JWT_SECRET: ${jwtSecret ? '✓ set (' + jwtSecret.length + ' chars)' : '✗ missing'}`);
  console.log(`   JWT_REFRESH_SECRET: ${process.env.JWT_REFRESH_SECRET ? '✓ set' : '✗ missing'}`);
  console.log(`   MONGODB_URI: ${mongoUri ? '✓ set' : '✗ missing'}`);
  console.log('');
};

module.exports = validateEnv;
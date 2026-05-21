const fs = require('node:fs')
const path = require('node:path')
const dotenv = require('dotenv')

const productionEnvPath = path.join(__dirname, '.env.production')

if (fs.existsSync(productionEnvPath)) {
  dotenv.config({ path: productionEnvPath, quiet: true })
}

function pickEnv(names) {
  return names.reduce((result, name) => {
    if (process.env[name]) {
      result[name] = process.env[name]
    }

    return result
  }, {})
}

const productionEnv = {
  NODE_ENV: 'production',
  PORT: process.env.PORT || 3001,
  DATABASE_PATH: process.env.DATABASE_PATH || path.join(__dirname, 'data', 'database.sqlite'),
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'),
  BACKUP_DIR: process.env.BACKUP_DIR || path.join(__dirname, 'backups'),
  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || '2mb',
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || 15 * 1024 * 1024,
  ...pickEnv([
    'JWT_SECRET',
    'CORS_ORIGINS',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'DIRECTUS_URL',
    'DIRECTUS_TOKEN',
    'DIRECTUS_DEFAULT_COMPANY_ID',
    'WEB_APP_URL',
    'OWNER_SETUP_TOKEN_TTL',
  ]),
}

module.exports = {
  apps: [
    {
      name: 'audit-backend',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: productionEnv,
    },
  ],
};

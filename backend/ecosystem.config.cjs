const path = require('node:path')

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
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        DATABASE_PATH: process.env.DATABASE_PATH || path.join(__dirname, 'data', 'database.sqlite'),
        UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'),
        JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || '2mb',
        MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || 5242880,
      },
    },
  ],
};

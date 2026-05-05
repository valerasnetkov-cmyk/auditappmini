module.exports = {
  apps: [
    {
      name: 'audit-backend',
      script: 'src/server.js',
      cwd: 'C:\\Projects\\Auditmini\\auditappmini\\backend', // Windows path
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
        PORT: 3001,
        JWT_SECRET: 'replace-with-strong-secret',
      },
    },
  ],
};

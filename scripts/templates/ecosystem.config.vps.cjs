module.exports = {
  apps: [
    {
      name: 'audit-backend',
      cwd: '/opt/auditappmini/backend',
      script: 'src/server.js',
      interpreter: 'node',
      node_args: '-r dotenv/config',
      env_production: {
        NODE_ENV: 'production',
        dotenv_config_path: '/opt/auditappmini/backend/.env.production',
      },
    },
    {
      name: 'audit-web',
      cwd: '/opt/auditappmini/web',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3002 -H 127.0.0.1',
      interpreter: 'node',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}

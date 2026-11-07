// ==============================================================================
// Wisely - PM2 Production Process Manager Yapılandırması
// ==============================================================================
// Kurulum: npm install -g pm2
// Başlatma: pm2 start ecosystem.config.cjs
// Durum Kontrolü: pm2 status
// Loglar: pm2 logs
// ==============================================================================

module.exports = {
  apps: [
    {
      name: 'wisely-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'wisely-promptfoo',
      script: 'npm',
      args: 'run promptfoo:view',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PROMPTFOO_CONFIG_DIR: './.promptfoo',
      },
    },
  ],
};

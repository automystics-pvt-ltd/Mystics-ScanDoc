// PM2 process configuration for DocScan API server
// Uploaded to: /home/automystics-docscan/app/ecosystem.config.cjs
// Usage:  pm2 start ecosystem.config.cjs
//         pm2 save && pm2 startup   (enable auto-start on reboot)

module.exports = {
  apps: [
    {
      name: "docscan-api",
      script: "./artifacts/api-server/dist/index.mjs",
      cwd: "/home/automystics-docscan/app",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",

      env: {
        NODE_ENV: "production",
        PORT: "3010",
      },

      // Load environment variables from .env file
      env_file: "/home/automystics-docscan/app/.env",

      // Logging
      out_file: "/home/automystics-docscan/logs/api-out.log",
      error_file: "/home/automystics-docscan/logs/api-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Graceful restart
      kill_timeout: 5000,
      wait_ready: false,
      listen_timeout: 10000,
    },
  ],
};

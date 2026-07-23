// PM2 process configuration for DocScan API server.
// Lives at the repo root — used by deploy.sh.
// Usage:  pm2 startOrRestart ecosystem.config.cjs --update-env

module.exports = {
  apps: [
    {
      name: "docscan-api",
      script: "./artifacts/api-server/dist/index.mjs",
      cwd: "/home/automystics-docscan/app",
      node_args: "--env-file /home/automystics-docscan/app/.env",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",

      env: {
        NODE_ENV: "production",
      },

      // Logs
      out_file: "/home/automystics-docscan/logs/api-out.log",
      error_file: "/home/automystics-docscan/logs/api-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};

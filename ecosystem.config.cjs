/** PM2 process definition — loads env from .env via scripts/run-with-env.js */
module.exports = {
  apps: [
    {
      name: "financial-data-analysis",
      script: "scripts/run-with-env.js",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      time: true,
    },
  ],
};

/**
 * Production process list for the DigitalOcean server.
 *
 * API entry is the same command as `npm run start:api`
 * (`node dist/src/main.js` with the working directory apps/api).
 * Web entry is the same command as `npm run start:web`
 * (`next start` with PORT=3000).
 *
 * Keep instances at 1. The API process also runs the BullMQ workers.
 * A second copy would compete for the same jobs.
 *
 * The repository-root .env is loaded by the API and by Next.js.
 * Do not commit that file.
 *
 * BIND_HOST in .env decides who can reach ports 3000 and 3001:
 *   0.0.0.0    anyone (only while the site is served on the IP over HTTP)
 *   127.0.0.1  only Caddy on this server (use this once HTTPS is on)
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;

/** One value from the root .env without loading the rest into PM2. */
function envValue(name, fallback) {
  try {
    const line = fs
      .readFileSync(path.join(root, '.env'), 'utf8')
      .split(/\r?\n/)
      .reverse()
      .find((entry) => entry.startsWith(`${name}=`));
    const value = line?.slice(name.length + 1).trim().replace(/^"|"$/g, '');
    return value || fallback;
  } catch {
    return fallback;
  }
}

const bindHost = envValue('BIND_HOST', '0.0.0.0');

module.exports = {
  apps: [
    {
      name: 'mca-api',
      cwd: path.join(root, 'apps', 'api'),
      script: 'dist/src/main.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        HOST: bindHost,
      },
      out_file: path.join(root, 'logs', 'mca-api-out.log'),
      error_file: path.join(root, 'logs', 'mca-api-error.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'mca-web',
      cwd: path.join(root, 'apps', 'web'),
      script: path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'),
      args: `start --hostname ${bindHost} --port 3000`,
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      out_file: path.join(root, 'logs', 'mca-web-out.log'),
      error_file: path.join(root, 'logs', 'mca-web-error.log'),
      merge_logs: true,
      time: true,
    },
  ],
};

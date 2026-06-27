const { spawn } = require('child_process');
const process = require('process');

const API_PORT = 3002;
const WEB_PORT = 3001;

function log(label, message) {
  const prefix = label.padStart(6, ' ');
  console.log(`[${prefix}] ${message}`);
}

function killPort(port) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin
      ? 'powershell'
      : 'sh';
    const args = isWin
      ? [
          '-Command',
          `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`,
        ]
      : [
          '-c',
          `lsof -ti:${port} | xargs -r kill -9 2>/dev/null || true`,
        ];

    const child = spawn(cmd, args, { stdio: 'ignore' });
    child.on('close', () => resolve(undefined));
    child.on('error', () => resolve(undefined));
  });
}

async function main() {
  log('boot', `Freeing ports ${WEB_PORT} and ${API_PORT}...`);
  await killPort(WEB_PORT);
  await killPort(API_PORT);

  log('boot', 'Starting API...');
  const api = spawn('pnpm', ['--filter', 'api', 'start:dev'], {
    stdio: 'pipe',
    shell: true,
  });

  log('boot', 'Starting Web...');
  const web = spawn('pnpm', ['--filter', 'web', 'dev'], {
    stdio: 'pipe',
    shell: true,
  });

  function forward(child, label) {
    child.stdout.on('data', (data) => {
      data
        .toString()
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .forEach((line) => log(label, line));
    });
    child.stderr.on('data', (data) => {
      data
        .toString()
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .forEach((line) => log(label, line));
    });
  }

  forward(api, 'api');
  forward(web, 'web');

  function shutdown() {
    log('boot', 'Shutting down...');
    api.kill('SIGTERM');
    web.kill('SIGTERM');
    setTimeout(() => {
      api.kill('SIGKILL');
      web.kill('SIGKILL');
      process.exit(0);
    }, 2000);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => {
    api.kill('SIGKILL');
    web.kill('SIGKILL');
  });

  api.on('exit', (code) => {
    log('api', `exited with code ${code ?? 0}`);
  });
  web.on('exit', (code) => {
    log('web', `exited with code ${code ?? 0}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

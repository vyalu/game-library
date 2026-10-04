// npm run check — автопроверка перед сборкой (Windows, Linux, macOS)
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
const py = process.platform === 'win32' ? 'python' : 'python3';
const files = ['main.js', 'preload.js', 'enricher.js', 'download.js', 'hltb.js', 'ai.js', ...fs.readdirSync(path.join(root, 'renderer')).map((f) => 'renderer/' + f)];
try {
  for (const f of files) run(process.execPath, ['--check', f]);
  console.log(`Синтаксис в порядке (${files.length} файлов)`);
  run(process.execPath, ['tests/stores.js']);
  run(process.execPath, ['tests/hltb.js']);
  run(process.execPath, ['tests/watch.js']);
  run(process.execPath, ['tests/tray.js']);
  run(process.execPath, ['tests/shots.js']);
  run(process.execPath, ['tests/steamsearch.js']);
  run(py, ['tests/names.py']);
  run(py, ['tests/smoke.py']);
} catch { process.exit(1); }

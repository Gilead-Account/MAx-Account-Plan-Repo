import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, copyFile, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('packaging removes older live ZIPs and retains the latest pair and unrelated files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'veeva-bundle-cleanup-'));
  try {
    await mkdir(path.join(root, 'scripts'));
    const dist = path.join(root, 'dist');
    await mkdir(dist);
    await copyFile(new URL('../scripts/postbuild.mjs', import.meta.url), path.join(root, 'scripts/postbuild.mjs'));
    const html = '<script src="data:text/javascript;base64,YQ=="></script>'.repeat(2);
    await writeFile(path.join(dist, 'index.html'), html);
    await writeFile(path.join(dist, 'kite_myinsights_v2_live_2000-01-01.zip'), 'old dated build');
    await writeFile(path.join(dist, 'kite_myinsights_v2_live_20000101_000000.zip'), 'old timestamped build');
    await writeFile(path.join(dist, 'unrelated.zip'), 'keep');
    execFileSync(process.execPath, [path.join(root, 'scripts/postbuild.mjs'), 'live'], { stdio: 'pipe' });
    const files = await readdir(dist);
    const bundles = files.filter((name) => name.startsWith('kite_myinsights_v2_live_'));
    assert.equal(bundles.length, 2);
    assert.ok(bundles.every((name) => !name.includes('2000')));
    assert.deepEqual(await readFile(path.join(dist, bundles[0])), await readFile(path.join(dist, bundles[1])));
    assert.equal(await readFile(path.join(dist, 'unrelated.zip'), 'utf8'), 'keep');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// Post-build packager. Runs after `vite build`.
//
// `vite build` (with viteSingleFile) already produces a single
// dist/index.html with all React JS/CSS inlined, plus the verbatim
// public/static/ folder with the Veeva runtime scripts (q.js,
// MyInsightsLibrary.js). This script:
//   1. Reads dist/index.html.
//   2. Inlines the Veeva runtime <script src="./static/*.js"> tags as
//      base64 data URIs. This matches the proven reactv4 iPad package and
//      ensures Q/DataService initialize before the React module executes.
//   3. Deletes dist/assets and dist/static so only the single index.html
//      remains.
//   4. Zips dist/index.html into dist/kite_myinsights_v2_YYYY-MM-DD.zip
//      ready for upload to Veeva CRM (matches kite_myinsights_accountplan
//      build_report_zip.mjs).

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const STATIC_SCRIPTS = ['q.js', 'MyInsightsLibrary.js'];
const buildVariant = process.argv[2];
if (buildVariant !== 'live') {
  throw new Error('Only CRM-live MyInsights ZIPs are supported. Run `npm run build`.');
}

const stampDate = new Date().toISOString().slice(0, 10);
const timestamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\..+$/, '')
  .replace('T', '_');
const ZIP_NAME = `kite_myinsights_v2_${buildVariant}_${stampDate}.zip`;
const STAMPED_NAME = `kite_myinsights_v2_${buildVariant}_${timestamp}.zip`;
const ZIP_PATH = path.join(DIST_DIR, ZIP_NAME);
const STAMPED_PATH = path.join(DIST_DIR, STAMPED_NAME);

function inlineVeevaRuntime(html) {
  for (const fileName of STATIC_SCRIPTS) {
    const sourcePath = path.join(DIST_DIR, 'static', fileName);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[postbuild] missing ${sourcePath}, skipping inline`);
      continue;
    }
    const source = fs.readFileSync(sourcePath, 'utf8');
    const base64 = Buffer.from(source, 'utf8').toString('base64');
    const replacement = `<script src="data:text/javascript;base64,${base64}"></script>`;
    const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `<script[^>]*src=["']\\.?/?static/${escapedName}(?:\\?[^"']*)?["'][^>]*></script>`
    );
    if (!pattern.test(html)) {
      console.warn(`[postbuild] could not find <script> tag for static/${fileName}`);
      continue;
    }
    html = html.replace(pattern, replacement);
    console.log(`[postbuild] inlined static/${fileName} (${(source.length / 1024).toFixed(1)} KB)`);
  }
  return html;
}

function runPowerShell(command) {
  for (const shell of ['powershell', 'pwsh']) {
    const result = spawnSync(shell, ['-NoLogo', '-NoProfile', '-Command', command], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    if (result.error && result.error.code === 'ENOENT') continue;
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || 'PowerShell command failed').trim());
    }
    return true;
  }
  return false;
}

function zipSingleFile(sourceFile, destinationPath) {
  const ps = `Compress-Archive -Path '${sourceFile.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`;
  if (runPowerShell(ps)) return;

  const result = spawnSync('zip', ['-j', '-q', destinationPath, sourceFile], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });
  if (result.error && result.error.code === 'ENOENT') {
    throw new Error('No archive command found. Install PowerShell or zip to build the report bundle.');
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'zip command failed').trim());
  }
}

function verifyLiveBundle(html) {
  const runtimeDataScripts = html.match(/<script src="data:text\/javascript;base64,/g) || [];
  if (runtimeDataScripts.length < STATIC_SCRIPTS.length) {
    throw new Error('Live bundle is missing an inlined Veeva runtime script.');
  }
  if (/static\/(?:q|MyInsightsLibrary)\.js/.test(html)) {
    throw new Error('Live bundle still contains an external Veeva runtime script reference.');
  }

  const forbiddenMockValues = [
    'Northstar Cancer Center',
    'FY26 Medical Account Plan - Northstar ATC',
    'Alex Morgan',
    'Jordan Lee',
    'Maya Chen',
    'James Rivera',
    'Avery Brooks',
    'Taylor Smith',
    'Medicaid step-edit requirement',
    'Improve Medicaid access position',
    'Coordinate timing across Medical, Market Access, and field teams',
  ];
  const leakedValue = forbiddenMockValues.find((value) => html.includes(value));
  if (leakedValue) {
    throw new Error(`Live bundle contains local mock data: ${leakedValue}`);
  }
}

function main() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('dist/index.html does not exist. Did vite build run?');
  }

  let html = fs.readFileSync(indexPath, 'utf8');
  html = inlineVeevaRuntime(html);
  verifyLiveBundle(html);
  fs.writeFileSync(indexPath, html, 'utf8');

  // Clean up extraneous output now that everything is in index.html.
  for (const folder of ['assets', 'static']) {
    const target = path.join(DIST_DIR, folder);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }

  for (const stale of [ZIP_PATH, STAMPED_PATH]) {
    if (fs.existsSync(stale)) fs.unlinkSync(stale);
  }

  zipSingleFile(indexPath, ZIP_PATH);
  fs.copyFileSync(ZIP_PATH, STAMPED_PATH);

  // Keep only the two ZIP names for this successful live build.
  for (const entry of fs.readdirSync(DIST_DIR, { withFileTypes: true })) {
    if (entry.isFile() && /^kite_myinsights_v2_live_.*\.zip$/.test(entry.name)
      && entry.name !== ZIP_NAME && entry.name !== STAMPED_NAME) {
      fs.unlinkSync(path.join(DIST_DIR, entry.name));
    }
  }

  const sizeKb = (fs.statSync(indexPath).size / 1024).toFixed(1);
  console.log('\nBuilt Veeva bundle:');
  console.log(`  data mode: ${buildVariant}`);
  console.log(`  ${indexPath}  (${sizeKb} KB self-contained HTML)`);
  console.log(`  ${ZIP_PATH}`);
  console.log(`  ${STAMPED_PATH}`);
  console.log('\nUpload the .zip to Veeva CRM > MyInsights.');
}

main();

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const packageJson = JSON.parse(await read('../package.json'));
const viteSource = await read('../vite.config.js');
const appSource = await read('../src/App.jsx');
const clientSource = await read('../src/lib/dataservice/client.js');
const indexSource = await read('../index.html');
const postbuildSource = await read('../scripts/postbuild.mjs');
const livePayerFixtures = await read('../src/lib/dataservice/marketAccessFixtures.live.js');
const sharedSource = await read('../src/lib/dataservice/accountPlan/shared.js');
const teamMembersSource = await read('../src/lib/dataservice/accountPlan/teamMembers.js');

test('the default deployable build uses the live Veeva DataService mode', () => {
  assert.match(packageJson.scripts.build, /vite build --mode production/);
  assert.match(packageJson.scripts.build, /postbuild\.mjs live/);
  assert.match(viteSource, /mockAdapter\.live\.js/);
  assert.doesNotMatch(viteSource, /mode === ['"]training['"]/);
  assert.match(clientSource, /const useMockData = isDev/);
  assert.doesNotMatch(clientSource, /VITE_DATA_MODE|isTrainingBuild/);
  assert.match(indexSource, /static\/q\.js/);
  assert.match(indexSource, /static\/MyInsightsLibrary\.js/);
  assert.match(postbuildSource, /verifyLiveBundle\(html\)/);
});

test('packaged Payer fixtures expose navigation and empty CRM-backed data states only', () => {
  assert.match(viteSource, /marketAccessFixtures\.live\.js/);
  assert.match(livePayerFixtures, /initialCommercialHierarchy\s*=\s*\[\]/);
  assert.match(livePayerFixtures, /initialCriticalActions\s*=\s*\[\]/);
  assert.match(livePayerFixtures, /milestonesAndEngagements\s*=\s*\[\]/);
  assert.match(livePayerFixtures, /issues\s*=\s*\[\]/);
  assert.doesNotMatch(livePayerFixtures, /Maya Chen|Alex Morgan|Medicaid step-edit/);
});

test('live application source has no seeded Account Plan or dummy header value', () => {
  assert.doesNotMatch(appSource, /LOCAL_MRD_DEMO_PLAN|FY26 Medical Account Plan - Northstar ATC|Mock1/);
  assert.doesNotMatch(sharedSource, /MM_ACCOUNT_PRIORITY_DUMMY|mmAccountPriority:\s*['"]On hold['"]/);
  assert.match(sharedSource, /mmAccountPriority:\s*null/);
});

test('Team Member options come from CRM metadata and fetched CRM rows only', () => {
  assert.doesNotMatch(teamMembersSource, /FALLBACK_PICKLISTS/);
  assert.match(teamMembersSource, /participationOptions:\s*mergeWithDataValues\(\s*participationPicklist,/);
  assert.match(teamMembersSource, /statusOptions:\s*mergeWithDataValues\(\s*statusPicklist,/);
});

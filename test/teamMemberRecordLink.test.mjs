import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const sharedModulePath = new URL('../src/lib/dataservice/accountPlan/shared.js', import.meta.url);
const teamMembersModulePath = new URL('../src/lib/dataservice/accountPlan/teamMembers.js', import.meta.url);
const teamMembersPagePath = new URL('../src/pages/TeamMembers/index.jsx', import.meta.url);
const teamMemberModalPath = new URL('../src/pages/TeamMembers/TeamMemberEditModal.jsx', import.meta.url);
const teamMembersCssPath = new URL('../src/pages/TeamMembers/TeamMembers.css', import.meta.url);

const loadSharedModule = async () => {
  globalThis.__teamMemberLookupQueries = [];

  const queryStubUrl = dataModule(`
    export const runQuery = (params) => {
      globalThis.__teamMemberLookupQueries.push(params);
      return Promise.resolve([{ Id: '0058C00000UserAAA', Name: 'Albin Karimattam' }]);
    };
    export const runCrmQuery = runQuery;
    export const getDataForCurrentObject = () => Promise.resolve(null);
    export const getCrmDataForCurrentObject = () => Promise.resolve(null);
    export const unwrap = (row) => row || null;
    export const buildIdMatchWhere = (field, id) => id ? field + " = '" + id + "'" : '';
    export const toCanonicalSalesforceId = (id) => id || null;
    export const salesforceIdVariants = (id) => id ? [id] : [];
    export const createRecord = () => Promise.resolve({ data: { id: 'new-record-id' } });
    export const createCrmRecord = createRecord;
    export const updateRecord = () => Promise.resolve({ data: { id: 'record-id' } });
  `);
  const clientStubUrl = dataModule(`
    export const bindAccountPlanDataContext = (id) => id;
    export const hasVeevaRuntime = () => false;
    export const isMockRuntime = true;
    export const isOnline = () => false;
  `);
  const approvalReviewDateStubUrl = dataModule(`
    export const acceptedApprovalReviewDate = () => null;
  `);

  const source = (await readFile(sharedModulePath, 'utf8'))
    .replace(/from ['"]@\/lib\/dataservice\/query['"]/g, `from '${queryStubUrl}'`)
    .replace(/from ['"]@\/lib\/dataservice\/client['"]/g, `from '${clientStubUrl}'`)
    .replace(/from ['"]@\/lib\/approvalReviewDate['"]/g, `from '${approvalReviewDateStubUrl}'`);

  const mod = await import(`${dataModule(source)}#${Date.now()}-${Math.random()}`);
  return { mod, queries: globalThis.__teamMemberLookupQueries };
};

test('team member popup lookup queries User records', async () => {
  const { mod, queries } = await loadSharedModule();

  const rows = await mod.searchUsers('albin', 60);

  assert.equal(queries[0].object, 'User');
  assert.deepEqual(queries[0].fields, ['Id', 'Name']);
  assert.match(queries[0].where, /Name LIKE '%albin%'/);
  assert.deepEqual(rows, [{ id: '0058C00000UserAAA', name: 'Albin Karimattam' }]);
});

test('Team Members page renders names as Lightning User record hyperlinks', async () => {
  const moduleSource = await readFile(teamMembersModulePath, 'utf8');
  const pageSource = await readFile(teamMembersPagePath, 'utf8');
  const cssSource = await readFile(teamMembersCssPath, 'utf8');

  assert.doesNotMatch(moduleSource, /viewRecord/);
  assert.doesNotMatch(moduleSource, /viewTeamMemberRecord/);
  assert.doesNotMatch(moduleSource, /teamMemberRecordTarget/);
  assert.doesNotMatch(pageSource, /viewTeamMemberRecord/);
  assert.doesNotMatch(pageSource, /teamMemberRecordTarget/);
  assert.match(pageSource, /TEAM_MEMBER_USER_RECORD_BASE_URL\s*=\s*'https:\/\/kitepharma--kitefull\.sandbox\.lightning\.force\.com\/lightning\/r\/User'/);
  assert.match(pageSource, /teamMemberUserRecordUrl\(member\.userId\)/);
  assert.match(pageSource, /team-member-record-link/);
  assert.match(pageSource, /target="_top"/);
  assert.match(pageSource, /<strong>\{member\.name\}<\/strong>/);
  assert.match(cssSource, /team-member-record-link/);
});

test('existing Medical team members expose participation as the only editable field', async () => {
  const modalSource = await readFile(teamMemberModalPath, 'utf8');

  assert.match(modalSource, /TEAM_MEMBER_NAME_FIELD[\s\S]*?key: 'name'[\s\S]*?readOnly: true/);
  assert.match(modalSource, /\{isNew \? \([\s\S]*?<AccountLookupField[\s\S]*?\) : \([\s\S]*?field=\{TEAM_MEMBER_NAME_FIELD\}/);
  assert.match(modalSource, /\{ label: 'Role', key: 'role', readOnly: true/);
  assert.match(modalSource, /\{ label: 'Status', key: 'status', readOnly: true/);
  assert.match(modalSource, /\{ label: 'Participation', key: 'participation', readOnly: false/);
  assert.match(modalSource, /if \(isNew && searchUsers && !form\.userId\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modalPath = new URL('../src/pages/AccountProfile/ReferralAccountEditModal.jsx', import.meta.url);

test('Referral Mapping add/edit modal exposes field-level info guidance for SME fields', async () => {
  const modalSource = await readFile(modalPath, 'utf8');

  assert.match(modalSource, /from '@\/components\/EditModalField'/);
  assert.match(modalSource, /const REFERRAL_MAPPING_HELP = \{/);

  assert.match(modalSource, /<AccountLookupField[\s\S]*?label="Site Name"/);
  assert.match(modalSource, /SF_ID_PATTERN\.test\(String\(form\.siteId \|\| ''\)\)/);
  assert.match(modalSource, /Select a Site Name from the Account list\./);
  assert.match(modalSource, /<Field label="# of HCP Targets within site">/);
  assert.match(modalSource, /value=\{form\.hcpTargetCount\}[\s\S]*?readOnly/);
  assert.match(modalSource, /<Field label="Referral Priority" help=\{REFERRAL_MAPPING_HELP\.referralPriority\}>/);
  assert.match(modalSource, /<Field label="Indication" help=\{REFERRAL_MAPPING_HELP\.indication\}>/);
  assert.match(modalSource, /value=\{form\.indication\}[\s\S]*?modalIndicationOptions\.map/);
  assert.match(modalSource, /<Field label="Comments" help=\{REFERRAL_MAPPING_HELP\.comments\} className="is-textarea">/);

  assert.match(modalSource, /Specifies the disease area or indication relevant to the site/);
  assert.match(modalSource, /DLBCL only or broader portfolio/);
  assert.match(modalSource, /Capture key context on referral behavior/);
  assert.match(modalSource, /any relevant observations that may impact referral flow or account strategy/);

  assert.doesNotMatch(modalSource, /<Field label="Site Name" help=/);
  assert.doesNotMatch(modalSource, /<Field label="HCO Classification" help=/);
  assert.match(modalSource, /Identifies whether the site prioritizes Kite/);
});

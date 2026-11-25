import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithEsbuild } from 'vite';

const poaPagePath = new URL('../src/pages/CrossFunctionalPlan/index.jsx', import.meta.url);

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

const loadPoaPageModule = async () => {
  const utilsStubUrl = dataModule(`
    export const formatDateLabel = (value, fallback) => value || fallback;
  `);
  const serviceStubUrl = dataModule(`
    export const savePoaBlock = () => Promise.resolve({});
  `);
  const fieldStubUrl = dataModule(`
    export const FieldHelpButton = () => ({});
  `);
  const reactStubUrl = dataModule(`
    export const useEffect = () => {};
    export const useMemo = (factory) => factory();
    export const useRef = () => ({ current: null });
    export const useState = (initialValue) => [
      typeof initialValue === 'function' ? initialValue() : initialValue,
      () => {}
    ];
  `);
  const jsxRuntimeStubUrl = dataModule(`
    export const Fragment = Symbol('Fragment');
    export const jsx = () => ({});
    export const jsxs = () => ({});
  `);

  const source = (await readFile(poaPagePath, 'utf8'))
    .replace(/from ['"]@\/components\/EditModalField['"]/g, `from '${fieldStubUrl}'`)
    .replace(/from ['"]@\/lib\/helper\/utils['"]/g, `from '${utilsStubUrl}'`)
    .replace(
      /from ['"]@\/lib\/dataservice\/accountPlan\/crossFunctionalPlan['"]/g,
      `from '${serviceStubUrl}'`
    );

  const transformed = await transformWithEsbuild(source, 'CrossFunctionalPlan/index.jsx', {
    loader: 'jsx',
    jsx: 'automatic',
  });
  const code = transformed.code
    .replace(/from ['"]react['"]/g, `from '${reactStubUrl}'`)
    .replace(/from ['"]react\/jsx-runtime['"]/g, `from '${jsxRuntimeStubUrl}'`);

  return import(`${dataModule(code)}#${Date.now()}-${Math.random()}`);
};

const poaBlock = (functionName) => ({ key: functionName, functionName });

test('POA visibility and edit access follow function rules', async () => {
  const mod = await loadPoaPageModule();
  const commercialUser = { profileName: 'Commercial Profile' };
  const marketAccessUser = { role: 'Market Access Director' };
  const marketAccessProfileUser = { profileName: 'KPH-Key Account Director' };
  const medicalUser = { role: 'Medical Science Liaison' };
  const commercialBlock = poaBlock('Customer Engagement');
  const marketAccessBlock = poaBlock('Market Access');
  const medicalBlock = poaBlock('Medical Affairs');

  assert.equal(mod.canViewPoaBlock(commercialUser, commercialBlock), true);
  assert.equal(mod.canViewPoaBlock(commercialUser, marketAccessBlock), true);
  assert.equal(mod.canViewPoaBlock(commercialUser, medicalBlock), true);
  assert.equal(mod.canEditPoaBlock(commercialUser, commercialBlock), true);
  assert.equal(mod.canEditPoaBlock(commercialUser, marketAccessBlock), false);
  assert.equal(mod.canEditPoaBlock(commercialUser, medicalBlock), false);

  assert.equal(mod.canViewPoaBlock(marketAccessUser, commercialBlock), true);
  assert.equal(mod.canViewPoaBlock(marketAccessUser, marketAccessBlock), true);
  assert.equal(mod.canViewPoaBlock(marketAccessUser, medicalBlock), true);
  assert.equal(mod.canEditPoaBlock(marketAccessUser, marketAccessBlock), true);
  assert.equal(mod.canEditPoaBlock(marketAccessUser, commercialBlock), false);
  assert.equal(mod.canEditPoaBlock(marketAccessUser, medicalBlock), false);

  assert.equal(mod.resolvePoaUserType(marketAccessProfileUser), 'market-access');
  assert.equal(mod.canViewPoaBlock(marketAccessProfileUser, commercialBlock), true);
  assert.equal(mod.canViewPoaBlock(marketAccessProfileUser, marketAccessBlock), true);
  assert.equal(mod.canViewPoaBlock(marketAccessProfileUser, medicalBlock), true);
  assert.equal(mod.canEditPoaBlock(marketAccessProfileUser, marketAccessBlock), true);
  assert.equal(mod.canEditPoaBlock(marketAccessProfileUser, commercialBlock), false);
  assert.equal(mod.canEditPoaBlock(marketAccessProfileUser, medicalBlock), false);

  assert.equal(mod.canViewPoaBlock(medicalUser, medicalBlock), true);
  assert.equal(mod.canViewPoaBlock(medicalUser, commercialBlock), false);
  assert.equal(mod.canViewPoaBlock(medicalUser, marketAccessBlock), false);
  assert.equal(mod.canEditPoaBlock(medicalUser, medicalBlock), true);

  assert.equal(mod.canViewPoaBlock({ profileName: 'Unknown Profile' }, commercialBlock), false);
  assert.equal(mod.canViewPoaBlock({ profileName: 'Unknown Profile' }, medicalBlock), true);
});

test('POA page builds rows from viewable blocks only', async () => {
  const source = await readFile(poaPagePath, 'utf8');

  assert.match(source, /blocks\.filter\(\(block\) => canViewPoaBlock\(currentUser, block\)\)/);
  assert.match(source, /POA_HELP_TEXT/);
  assert.match(source, /className="poa-page-subheader"/);
  assert.match(source, /<p className="poa-page-subheader">{POA_HELP_TEXT\.subheader}<\/p>/);
  assert.doesNotMatch(source, /Cross Functional Account Plan guidance/);
  assert.match(source, /Choose the open opportunities and medical tactics/);
  assert.match(source, /block\.functionName === MEDICAL_POA_FUNCTION/);
  assert.match(source, /rows\.length === 0/);
  assert.match(source, /rows\.length > 0/);
});

test('Medical POA defaults to all open items and persists excluded selections', async () => {
  const mod = await loadPoaPageModule();
  const block = { indication: 'DLBCL', functionName: 'Medical Affairs' };
  const opportunities = [{
    id: '006000000000001AAA',
    indication: 'DLBCL',
    medicalTactics: [{ id: '007000000000001AAA' }],
  }];

  const defaults = mod.medicalPoaSelectionFromContent('', block, opportunities);
  assert.deepEqual([...defaults], [
    'opportunity:006000000000001',
    'tactic:007000000000001',
  ]);

  defaults.delete('tactic:007000000000001');
  const stored = mod.serializeMedicalPoaSelection(defaults, block, opportunities);
  assert.equal(stored, 'MPOA1|x=007000000000001');
  assert.deepEqual([...mod.medicalPoaSelectionFromContent(stored, block, opportunities)], [
    'opportunity:006000000000001',
  ]);
});

test('Medical POA keeps mock opportunities and tactics independently selectable', async () => {
  const mod = await loadPoaPageModule();
  const block = { indication: 'DLBCL', functionName: 'Medical Affairs' };
  const opportunities = [
    {
      id: 'a2B8C00000MockBD5',
      indication: 'DLBCL',
      medicalTactics: [{ id: 'a3C8C00000MockAct4' }, { id: 'a3C8C00000MockAct5' }],
    },
    {
      id: 'a2B8C00000MockBD6',
      indication: 'DLBCL',
      medicalTactics: [{ id: 'a3C8C00000MockAct6' }],
    },
  ];

  const selected = mod.medicalPoaSelectionFromContent('', block, opportunities);
  assert.equal(selected.size, 5);
  selected.delete('opportunity:a2B8C00000MockBD5');
  assert.equal(selected.has('tactic:a3C8C00000MockAct4'), true);
  assert.equal(selected.has('opportunity:a2B8C00000MockBD6'), true);

  const stored = mod.serializeMedicalPoaSelection(selected, block, opportunities);
  assert.equal(stored, 'MPOA1|x=a2B8C00000MockBD5');
});

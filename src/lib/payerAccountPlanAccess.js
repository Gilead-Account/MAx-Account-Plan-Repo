const key = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const departmentKey = (value) => key(value)
  .replace(/^kph\s*[-\u2010-\u2015:]\s*/, '')
  .replace(/[()\-\u2010-\u2015:/]+/g, ' ')
  .replace(/\s+/g, ' ').trim();
const territoryKey = (value) => key(value).replace(/[-\u2010-\u2015]+/g, ' ').replace(/\s+/g, ' ').trim();
const roleAliases = (abbreviation, name) => [
  abbreviation, name, `${abbreviation} ${name}`, `${name} ${abbreviation}`,
].map(departmentKey);

const editors = new Set([
  ...roleAliases('NPAD', 'National Payer Account Director'),
  'Senior Director, Key Accounts', 'Strategic Engagement Head',
].map(departmentKey));
const territoryEditors = new Set(roleAliases('KAD', 'Key Account Director'));
const readers = new Set([
  ...roleAliases('NAD', 'National Account Director'),
  ...roleAliases('RAD', 'Regional Account Director'),
]);
const profileEditors = new Set(['KPH-Home Office', 'System Administrator'].map(key));

// Profile editors take precedence over department and territory restrictions.
// Missing departments and territories never confer edit access. Marketplace
// names are compared in full; substring matches could grant another market.
export const payerAccountPlanAccess = (user, plan, profileName) => {
  if (profileEditors.has(key(profileName))) return { canEdit: true, reason: '' };
  const department = departmentKey(user?.Department);
  if (editors.has(department)) return { canEdit: true, reason: '' };
  if (readers.has(department)) return { canEdit: false, reason: 'Your department has read-only access to Account Plans.' };
  if (territoryEditors.has(department)) {
    const territory = territoryKey(user?.KPH_Primary_Territory_Description__c);
    if (territory && territory === territoryKey(plan?.KPH_Territory_Description__c)) {
      return { canEdit: true, reason: '' };
    }
    return { canEdit: false, reason: 'KADs can edit only Account Plans in their primary territory / marketplace.' };
  }
  const detail = key(user?.Department)
    ? ` Department received: "${String(user.Department).trim()}".`
    : ' User.Department is blank or unavailable.';
  return { canEdit: false, reason: `Your department does not have edit access to Account Plans.${detail}` };
};

// CRM can return Date instances while local fixtures use ISO strings.
// Keep date-only strings on their calendar day and never render raw objects.
export const payerDateInputValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const isoDay = typeof value === 'string'
    ? value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/)
    : null;
  let date;
  if (isoDay) {
    date = new Date(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]));
    if (date.getFullYear() !== Number(isoDay[1]) ||
        date.getMonth() + 1 !== Number(isoDay[2]) ||
        date.getDate() !== Number(isoDay[3])) return '';
    return isoDay[0].slice(0, 10);
  }
  if (typeof value !== 'string' && Object.prototype.toString.call(value) !== '[object Date]') return '';
  date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const formatPayerDate = (value) => {
  const dayValue = payerDateInputValue(value);
  if (!dayValue) return '-';
  const [year, month, day] = dayValue.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(year, month - 1, day));
};

// Salesforce Date fields use a calendar date, not a UTC DateTime. Use the
// device's calendar day so evening edits on iPad do not become tomorrow.
export const crmDateToday = (now = new Date()) => {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid date.');
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

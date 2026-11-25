// Veeva may wrap the Salesforce validation error in a generic RecordError.
export function crmWriteError(error, context) {
  const messages = [];
  const seen = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const key of ['message', 'errorMessage', 'msg', 'errorCode', 'statusCode']) {
      if (typeof value[key] === 'string') messages.push(value[key]);
    }
    for (const key of ['data', 'errors', 'error', 'details', 'body', 'response', 'cause', 'fieldErrors', 'pageErrors']) {
      const child = value[key];
      if (typeof child === 'string') {
        try { visit(JSON.parse(child)); } catch { messages.push(child); }
      } else if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') {
        visit(child);
        Object.values(child).forEach((item) => Array.isArray(item) ? item.forEach(visit) : visit(item));
      }
    }
  };
  if (typeof error === 'string') messages.push(error);
  else visit(error);
  const specific = [...new Set(messages)].filter((message) => !/^An error occurred while trying to update the record\. Please try again\.?$/i.test(message));
  const detail = specific.length ? specific.join(' · ') : 'CRM rejected the save without a detailed reason. Check required fields, validation rules, and field access for this user.';
  return new Error(`${context}: ${detail}`);
}

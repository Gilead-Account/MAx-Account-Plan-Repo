export const REQUIRED_FIELDS_PROMPT = 'Please complete all required fields before saving.';

export function missingRequiredFields(form) {
  return Array.from(form.elements).filter((control) => {
    if (!control.required || !control.willValidate) return false;
    return control.validity.valueMissing || (
      typeof control.value === 'string' && !control.value.trim()
      && !['checkbox', 'radio', 'file'].includes(control.type)
    );
  });
}

export function validateModalSubmit(event) {
  const form = event.currentTarget;
  const missing = missingRequiredFields(form);
  if (missing.length) {
    event.preventDefault();
    return false;
  }
  if (!form.reportValidity()) {
    event.preventDefault();
    return false;
  }
  return true;
}

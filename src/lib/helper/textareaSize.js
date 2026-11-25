export function resizeTextareaToContent(textarea) {
  if (!textarea || !textarea.clientWidth) return;
  const computed = getComputedStyle(textarea);
  const number = (value) => Number.parseFloat(value) || 0;
  const border = number(computed.borderTopWidth) + number(computed.borderBottomWidth);
  const padding = number(computed.paddingTop) + number(computed.paddingBottom);
  // Reset first so removing text or widening the field also shrinks it.
  textarea.style.height = 'auto';
  const height = textarea.scrollHeight + (computed.boxSizing === 'border-box' ? border : -padding);
  textarea.style.height = `${Math.ceil(height)}px`;
}

export default function CharacterUsage({ value, maxLength, id, minimumLimit = 400, className = 'field-character-usage', as: Element = 'small' }) {
  const limit = Number(maxLength);
  if (!Number.isFinite(limit) || limit < minimumLimit) return null;
  return <Element id={id} className={className}>
    {String(value ?? '').length.toLocaleString('en-US')} / {limit.toLocaleString('en-US')} characters
  </Element>;
}

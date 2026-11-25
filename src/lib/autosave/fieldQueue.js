// Serialize writes so an older request can never finish after a newer write.
export function createFieldQueue({ save, onState = () => {}, delay = 600 }) {
  const pending = new Map();
  const timers = new Map();
  let chain = Promise.resolve();
  function flush(key) {
    const keys = key === undefined ? [...pending.keys()] : [key];
    for (const field of keys) {
      clearTimeout(timers.get(field));
      timers.delete(field);
      const entry = pending.get(field);
      if (!entry || entry.queued) continue;
      entry.queued = true;
      chain = chain.then(async () => {
        if (pending.get(field) !== entry) return;
        onState(field, 'saving');
        try {
          await save(field, entry.value);
          if (pending.get(field) === entry) {
            pending.delete(field);
            onState(field, 'saved');
          }
        } catch (error) {
          if (pending.get(field) === entry) {
            entry.queued = false;
            onState(field, 'error', error);
          }
        }
      });
    }
    return chain;
  }
  return {
    change(key, value, immediate = false) {
      clearTimeout(timers.get(key));
      pending.set(key, { value, queued: false });
      onState(key, 'pending');
      if (immediate) return flush(key);
      timers.set(key, setTimeout(() => flush(key), delay));
    },
    flush,
  };
}

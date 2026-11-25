export const SUCCESS_NOTICE_EVENT = 'payer-success-notice';

export function notifySaved(message = 'Changes saved. Your changes have been saved.') {
  window.dispatchEvent(new CustomEvent(SUCCESS_NOTICE_EVENT, { detail: message }));
}

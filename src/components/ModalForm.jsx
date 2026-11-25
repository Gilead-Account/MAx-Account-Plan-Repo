import { Children, useEffect, useRef, useState } from 'react';
import { missingRequiredFields, REQUIRED_FIELDS_PROMPT, validateModalSubmit } from '@/lib/helper/modalRequiredFields';
import '@/styles/modal-form.css';

export default function ModalForm({ children, onSubmit, onInput, onChange, validationError = '', ...props }) {
  const [requiredPrompt, setRequiredPrompt] = useState('');
  const [attempt, setAttempt] = useState(0);
  const promptRef = useRef(null);
  const message = requiredPrompt || validationError;

  useEffect(() => {
    if (message) {
      promptRef.current?.focus({ preventScroll: true });
      promptRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [message, attempt]);

  const clearCompletedPrompt = (event) => {
    if (requiredPrompt && !missingRequiredFields(event.currentTarget).length) setRequiredPrompt('');
  };
  const content = Children.toArray(children);
  const headerIndex = content.findIndex((child) => child.type === 'header');
  content.splice(headerIndex + 1, 0, message ? (
    <div key="required-fields-prompt" ref={promptRef} className="modal-required-fields-prompt" role="alert" tabIndex={-1}>
      {message}
    </div>
  ) : null);

  return <form
    {...props}
    noValidate
    onInput={(event) => { clearCompletedPrompt(event); onInput?.(event); }}
    onChange={(event) => { clearCompletedPrompt(event); onChange?.(event); }}
    onSubmit={(event) => {
      setAttempt((current) => current + 1);
      if (missingRequiredFields(event.currentTarget).length) {
        event.preventDefault();
        setRequiredPrompt(REQUIRED_FIELDS_PROMPT);
        return;
      }
      setRequiredPrompt('');
      if (validateModalSubmit(event)) onSubmit?.(event);
    }}
  >{content}</form>;
}

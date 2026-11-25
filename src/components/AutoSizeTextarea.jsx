import { useLayoutEffect, useRef } from 'react';
import { resizeTextareaToContent } from '@/lib/helper/textareaSize';

export default function AutoSizeTextarea({ value, placeholder, className = '', ...props }) {
  const textareaRef = useRef(null);
  useLayoutEffect(() => {
    resizeTextareaToContent(textareaRef.current);
  }, [value, placeholder]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    let active = true;
    let previousWidth = textarea.clientWidth;
    const fit = () => { if (active) resizeTextareaToContent(textarea); };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (textarea.clientWidth === previousWidth) return;
      previousWidth = textarea.clientWidth;
      fit();
    }) : null;
    observer?.observe(textarea);
    window.addEventListener('resize', fit);
    document.fonts?.ready.then(fit);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  return <textarea {...props} ref={textareaRef} value={value} placeholder={placeholder} className={`auto-size-textarea ${className}`.trim()}/>;
}

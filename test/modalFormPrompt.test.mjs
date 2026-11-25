import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('modal validation errors appear after the header and before the scrollable fields', async () => {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  });
  try {
    const { default: ModalForm } = await server.ssrLoadModule('/src/components/ModalForm.jsx');
    const children = [
      createElement('header', { key: 'header' }, 'Edit record'),
      createElement('div', { key: 'body', className: 'stakeholder-edit-body' }, 'Fields'),
      createElement('footer', { key: 'footer' }, 'Save'),
    ];
    const pristine = renderToStaticMarkup(createElement(ModalForm, {}, children));
    assert.doesNotMatch(pristine, /role="alert"/);
    const invalid = renderToStaticMarkup(createElement(ModalForm, {
      validationError: 'Select a Stakeholder Name from the account search results.',
    }, children));
    assert.match(invalid, /<form novalidate=""/);
    assert.match(invalid, /<header>Edit record<\/header><div[^>]*role="alert"[^>]*>Select a Stakeholder Name/);
    assert.ok(invalid.indexOf('role="alert"') < invalid.indexOf('stakeholder-edit-body'));
    assert.match(invalid, /tabindex="-1"/);
  } finally {
    await server.close();
  }
});

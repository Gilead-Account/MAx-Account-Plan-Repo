import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('character usage follows the current value and appears only at limits of 400 or more', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  try {
    const { default: CharacterUsage } = await server.ssrLoadModule('/src/components/CharacterUsage.jsx');
    const render = (value, maxLength) => renderToStaticMarkup(createElement(CharacterUsage, { value, maxLength }));
    assert.match(render('', 400), /0 \/ 400 characters/);
    assert.match(render('hello', '1000'), /5 \/ 1,000 characters/);
    assert.match(render('hello world', 1000), /11 \/ 1,000 characters/);
    assert.match(render(null, 5000), /0 \/ 5,000 characters/);
    assert.match(render('x'.repeat(500), 500), /500 \/ 500 characters/);
    for (const limit of [undefined, 250, 399]) assert.equal(render('hello', limit), '');
    const shortCounter = renderToStaticMarkup(createElement(CharacterUsage, { value: 'hello', maxLength: 100, minimumLimit: 0, as: 'span' }));
    assert.match(shortCounter, /<span[^>]*>5 \/ 100 characters<\/span>/);

    const { default: Field } = await server.ssrLoadModule('/src/components/EditModalField.jsx');
    const markup = renderToStaticMarkup(createElement(Field, { label: 'Comments', help: 'Field guidance' }, createElement('textarea', { maxLength: 1000, value: 'hello', readOnly: true })));
    assert.match(markup, /5 \/ 1,000 characters/);
    assert.match(markup, /aria-describedby="[^"]*-description [^"]*-character-count"/);
    assert.match(markup, /<small id="[^"]*-character-count"/);
    const shortField = renderToStaticMarkup(createElement(Field, { label: 'Title' }, createElement('input', { maxLength: 250, value: 'hello', readOnly: true })));
    assert.doesNotMatch(shortField, /field-character-usage/);

    const { EditableTextField } = await server.ssrLoadModule('/src/pages/AccountLandscape/index.jsx');
    for (const label of ['Network Approach/Site Inclusion Criteria', 'Decision Making Bodies Notes', 'Review Process, Timelines & Pre-Policy Approach to CG&T']) {
      for (const compact of [false, true]) {
        const field = renderToStaticMarkup(createElement(EditableTextField, { label, value: 'x'.repeat(1000), maxLength: '1000', compact }));
        const counters = [...field.matchAll(/<small class="stakeholder-map-character-count">([^<]+)<\/small>/g)];
        assert.equal(counters.length, 1, `${label} must have exactly one counter`);
        assert.equal(counters[0][1], '1,000 / 1,000 characters');
      }
    }
  } finally {
    await server.close();
  }
});

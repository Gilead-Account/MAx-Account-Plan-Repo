import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { runInNewContext } from 'node:vm';
import { formatPayerDate, payerDateInputValue } from '../src/lib/helper/payerDates.js';

test('CRM Date values render safely as React children and populate date inputs', () => {
  const dates = [new Date(2026, 9, 1), runInNewContext('new Date(2026, 9, 1)')];
  for (const date of dates) {
    assert.equal(formatPayerDate(date), 'Oct 1, 2026');
    assert.equal(payerDateInputValue(date), '2026-10-01');
    assert.equal(renderToStaticMarkup(React.createElement('td', null, formatPayerDate(date))), '<td>Oct 1, 2026</td>');
  }
});

test('ISO dates retain the calendar day for labels and HTML date inputs', () => {
  for (const value of ['2026-10-01', '2026-10-01T00:00:00.000Z']) {
    assert.equal(formatPayerDate(value), 'Oct 1, 2026');
    assert.equal(payerDateInputValue(value), '2026-10-01');
  }
});

test('empty and invalid CRM dates have safe text and input fallbacks', () => {
  for (const value of [null, undefined, '', new Date(NaN), {}, 'not-a-date', '2026-02-30']) {
    assert.equal(formatPayerDate(value), '-');
    assert.equal(payerDateInputValue(value), '');
  }
});

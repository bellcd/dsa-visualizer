import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { App } from './app.js';

test('App lists demo-swap under ?fixtures', () => {
  const html = renderToStaticMarkup(<App search="?fixtures" />);
  expect(html).toContain('<li>Demo: swap</li>');
});

test('App hides the Fixtures group without ?fixtures', () => {
  const html = renderToStaticMarkup(<App search="" />);
  expect(html).not.toContain('Fixtures');
});

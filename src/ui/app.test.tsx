import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { App } from './app.js';

test('App lists each algorithm name from the given menuGroups', () => {
  const html = renderToStaticMarkup(
    <App
      search=""
      menuGroups={() => [
        {
          name: 'Sorting',
          hidden: false,
          defs: [
            {
              id: 'swap-one',
              name: 'Swap one',
              pseudocode: [],
              inputFields: [],
              validate() {},
              setup: () => ({}),
              run() {},
            },
          ],
        },
      ]}
    />,
  );
  expect(html).toContain('<h2>Sorting</h2><ul><li>Swap one</li></ul>');
});

test('App passes its search to menuGroups', () => {
  const html = renderToStaticMarkup(
    <App
      search="?probe"
      menuGroups={(search) => [
        { name: `Searched ${search}`, hidden: false, defs: [] },
      ]}
    />,
  );
  expect(html).toContain('<h2>Searched ?probe</h2>');
});

import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { AlgorithmGroup } from '../algorithms/index.js';
import { App } from './app.js';

const menuGroups = (search: string): readonly AlgorithmGroup[] => {
  const showHidden = search === '?hidden';
  const groups: AlgorithmGroup[] = [
    {
      name: 'Shown group',
      hidden: false,
      defs: [
        {
          id: 'shown-one',
          name: 'Shown one',
          pseudocode: [],
          inputFields: [],
          validate() {},
          setup: () => ({}),
          run() {},
        },
      ],
    },
    {
      name: 'Hidden group',
      hidden: true,
      defs: [
        {
          id: 'hidden-one',
          name: 'Hidden one',
          pseudocode: [],
          inputFields: [],
          validate() {},
          setup: () => ({}),
          run() {},
        },
      ],
    },
  ];
  return groups.filter((group) => showHidden || !group.hidden);
};

test('App lists each algorithm name from the given menuGroups', () => {
  const html = renderToStaticMarkup(
    <App search="?hidden" menuGroups={menuGroups} />,
  );
  expect(html).toContain('<li>Hidden one</li>');
});

test('App omits groups the given menuGroups leaves out', () => {
  const html = renderToStaticMarkup(<App search="" menuGroups={menuGroups} />);
  expect(html).not.toContain('Hidden group');
});

import { menuGroups } from '../algorithms/index.js';

export function App({ search }: { search: string }) {
  return (
    <main>
      <h1>DSA visualizer</h1>
      <nav aria-label="Algorithm picker">
        {menuGroups(search).map((group) => (
          <section key={group.name}>
            <h2>{group.name}</h2>
            <ul>
              {group.defs.map((def) => (
                <li key={def.id}>{def.name}</li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </main>
  );
}

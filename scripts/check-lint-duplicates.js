#!/usr/bin/env node
import { readFileSync } from 'node:fs';

function listRules(configPath) {
  const rules =
    JSON.parse(readFileSync(configPath, 'utf8')).linter?.rules ?? {};
  const listed = [];
  for (const [group, groupRules] of Object.entries(rules)) {
    if (typeof groupRules !== 'object' || groupRules === null) continue;
    for (const rule of Object.keys(groupRules)) listed.push(`${group}/${rule}`);
  }
  return listed;
}

function main(params) {
  const strictRules = new Set(listRules(params.strictPath));
  const duplicates = listRules(params.allPath).filter((rule) =>
    strictRules.has(rule),
  );
  for (const rule of duplicates) {
    console.error(
      `${rule} is already set in ${params.strictPath}. Delete it from ${params.allPath}.`,
    );
  }
  process.exit(duplicates.length > 0 ? 1 : 0);
}

const [strictPath = 'biome.json', allPath = 'lint-all/biome.json'] =
  process.argv.slice(2);
main({ strictPath, allPath });

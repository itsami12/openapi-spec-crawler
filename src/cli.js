const path = require('node:path');
const fs = require('node:fs/promises');
const { crawl } = require('./crawler');
const { runUpdateCycle } = require('./update');
const { createLogger } = require('./logger');
const { saveCatalog, loadCatalog, createCatalogEntry, upsertCatalogEntry } = require('./catalog-store');
const { parseSpec } = require('./spec-parser');
const { sha256 } = require('./hash');

function parseArgs(argv) {
  const args = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }

    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return { args, positional };
}

async function runDemo() {
  const logger = createLogger('demo-run');
  const catalogPath = path.resolve(process.cwd(), 'catalog.json');
  const firstSource = path.resolve(__dirname, '..', 'fixtures', 'openapi-v1.yaml');
  const secondSource = path.resolve(__dirname, '..', 'fixtures', 'openapi-v2.yaml');

  await saveCatalog(catalogPath, []);

  const firstResult = await crawl({
    catalogPath,
    queries: [],
    seeds: [{ id: 'demo:payments', url: firstSource, type: 'local' }],
    limit: 1,
    logger,
  });

  const updatedCatalog = await loadCatalog(catalogPath);
  const previousEntry = updatedCatalog[0];
  const nextContent = await fs.readFile(secondSource, 'utf8');
  const parsedSpec = parseSpec(nextContent, secondSource);
  const nextEntry = createCatalogEntry({
    id: 'demo:payments',
    sourceUrl: secondSource,
    parsedSpec,
    contentHash: sha256(nextContent),
    fetchedAt: new Date().toISOString(),
    previousEntry,
    previousHash: previousEntry?.content_hash || null,
    diff: null,
  });
  nextEntry.spec_snapshot = parsedSpec.document;

  const merged = await loadCatalog(catalogPath);
  const outcome = upsertCatalogEntry(merged, nextEntry);
  await saveCatalog(catalogPath, merged);

  const updateSummary = await runUpdateCycle({
    catalogPath,
    queries: [],
    seeds: [{ id: 'demo:payments', url: secondSource, type: 'local' }],
    limit: 1,
    logger,
  });

  console.log(JSON.stringify({ firstResult, outcome: outcome.action, updateSummary }, null, 2));
}

async function main() {
  const { args, positional } = parseArgs(process.argv.slice(2));
  const command = positional[0] || 'help';
  const catalogPath = path.resolve(process.cwd(), args.catalog || 'catalog.json');
  const logger = createLogger();

  if (command === 'demo') {
    await runDemo();
    return;
  }

  if (command === 'crawl') {
    const queries = args.query ? [args.query] : ['filename:openapi.yaml', 'filename:openapi.json', 'filename:swagger.yaml', 'filename:swagger.json'];
    const seeds = args.seed ? [{ id: `seed:${args.seed}`, url: args.seed, type: 'local' }] : [];
    const result = await crawl({
      catalogPath,
      token: args.token,
      queries,
      seeds,
      limit: Number(args.limit || 5),
      logger,
    });

    console.log(JSON.stringify(result.summary, null, 2));
    return;
  }

  if (command === 'update') {
    const result = await runUpdateCycle({
      catalogPath,
      token: args.token,
      queries: args.query ? [args.query] : ['filename:openapi.yaml'],
      seeds: args.seed ? [{ id: `seed:${args.seed}`, url: args.seed, type: 'local' }] : [],
      limit: Number(args.limit || 5),
      logger,
    });

    console.log(JSON.stringify(result.summary, null, 2));
    return;
  }

  console.log(`Usage:\n  node src/cli.js crawl --token <github_token> --query "filename:openapi.yaml" --limit 5\n  node src/cli.js update --catalog catalog.json\n  node src/cli.js demo`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

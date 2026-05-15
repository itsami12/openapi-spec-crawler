const path = require('node:path');
const { crawl } = require('./crawler');

async function runUpdateCycle(options = {}) {
  const pollIntervalHours = options.pollIntervalHours || 24;
  const result = await crawl({
    ...options,
    catalogPath: options.catalogPath || path.resolve(process.cwd(), 'catalog.json'),
  });

  return {
    pollIntervalHours,
    ...result,
  };
}

module.exports = { runUpdateCycle };

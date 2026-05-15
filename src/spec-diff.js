function toPathSet(spec) {
  return new Set(Object.keys(spec?.paths || {}));
}

function diffPaths(previousSpec, currentSpec) {
  const previousPaths = toPathSet(previousSpec);
  const currentPaths = toPathSet(currentSpec);

  const added = [];
  const removed = [];

  for (const path of currentPaths) {
    if (!previousPaths.has(path)) {
      added.push(path);
    }
  }

  for (const path of previousPaths) {
    if (!currentPaths.has(path)) {
      removed.push(path);
    }
  }

  return {
    added,
    removed,
    addedCount: added.length,
    removedCount: removed.length,
  };
}

module.exports = { diffPaths };

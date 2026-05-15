function createLogger(runId = `run-${Date.now()}`) {
  function emit(level, message, details = {}) {
    const payload = {
      ts: new Date().toISOString(),
      runId,
      level,
      message,
      ...details,
    };

    const line = JSON.stringify(payload);
    if (level === 'error') {
      console.error(line);
      return;
    }

    console.log(line);
  }

  return {
    runId,
    info(message, details) {
      emit('info', message, details);
    },
    warn(message, details) {
      emit('warn', message, details);
    },
    error(message, details) {
      emit('error', message, details);
    },
  };
}

module.exports = { createLogger };

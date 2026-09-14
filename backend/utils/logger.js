const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? (process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug);

function write(level, scope, message, meta) {
  if (LEVELS[level] > currentLevel) return;
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] [${scope}] ${message}`;
  const out = level === "error" || level === "warn" ? console.error : console.log;
  out(meta !== undefined ? `${line} ${JSON.stringify(meta)}` : line);
}

// scoped(module name) -> { info, warn, error, debug }, e.g. logger.scope("LinkedIn Ads")
function scope(name) {
  return {
    info: (message, meta) => write("info", name, message, meta),
    warn: (message, meta) => write("warn", name, message, meta),
    error: (message, meta) => write("error", name, message, meta),
    debug: (message, meta) => write("debug", name, message, meta),
  };
}

module.exports = { scope };

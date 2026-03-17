const formatMessage = (level, message, meta) => {
  const base = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  if (!meta) return base;
  return `${base} ${JSON.stringify(meta)}`;
};

module.exports = {
  info(message, meta) {
    console.log(formatMessage('info', message, meta));
  },
  warn(message, meta) {
    console.warn(formatMessage('warn', message, meta));
  },
  error(message, meta) {
    console.error(formatMessage('error', message, meta));
  },
};

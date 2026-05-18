export function logInfo(message) {
  console.log(`[${localTimestamp()}] ${message}`);
}

export function logError(message) {
  console.error(`[${localTimestamp()}] ${message}`);
}

function localTimestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-')
    + ' '
    + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join(':');
}

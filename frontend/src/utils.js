export function formatElapsed(ms) {
  if (!ms || ms < 0) {
    return "0s";
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function average(numbers) {
  if (!numbers.length) {
    return 0;
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export function extractScore(markdown, label) {
  const pattern = new RegExp(`${label}[\\s\\S]*?(\\d{1,2})\\s*\\/\\s*10|${label}[\\s\\S]*?(\\d{1,2})\\s*(?:out of 10)?`, "i");
  const match = markdown.match(pattern);
  const score = Number(match?.[1] || match?.[2]);
  return Number.isFinite(score) ? Math.min(score, 10) : null;
}

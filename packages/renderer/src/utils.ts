export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  })[character] ?? character);
}

export function emphasize(text: string, words: string[]): string {
  if (words.length === 0) return escapeHtml(text);
  const sortedWords = [...words].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sortedWords.map(escapeRegExp).join("|")})`, "g");
  return text.split(pattern).map((part) =>
    sortedWords.includes(part) ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)
  ).join("");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

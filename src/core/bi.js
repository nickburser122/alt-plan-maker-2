export const bi = (en, ar) => ({ en, ar });

export function biLabel(entry, lang) {
  if (!entry) return '';
  return entry[lang] || entry.en || '';
}

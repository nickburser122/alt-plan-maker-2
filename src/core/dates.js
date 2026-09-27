export function pISO(s) {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

export function fISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function addISO(s, n) {
  const d = pISO(s);
  d.setDate(d.getDate() + n);
  return fISO(d);
}

export function dowOf(s) {
  return pISO(s).getDay();
}

export function dayGap(a, b) {
  const da = pISO(a);
  const db = pISO(b);
  return Math.round((db - da) / 86400000);
}

export function isBefore(a, b) {
  return a < b;
}

export function clampISO(s, min, max) {
  if (min && s < min) return min;
  if (max && s > max) return max;
  return s;
}

export function eachISO(start, end) {
  const out = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addISO(cur, 1);
  }
  return out;
}

export function monthBounds(s) {
  const d = pISO(s);
  const start = fISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const end = fISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { start, end };
}

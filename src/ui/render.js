export function createActionRegistry() {
  const map = new Map();
  return {
    on(name, handler) { map.set(name, handler); },
    dispatch(e, ctx) {
      const el = e.target.closest('[data-act]');
      if (!el) return false;
      const handler = map.get(el.dataset.act);
      if (!handler) return false;
      handler(el, e, ctx);
      return true;
    }
  };
}

export function patchList(container, items, { key, create, update }) {
  const existing = new Map();
  for (const child of [...container.children]) {
    if (child.dataset?.key) existing.set(child.dataset.key, child);
    else child.remove();
  }
  let cursor = container.firstChild;
  for (const item of items) {
    const k = String(key(item));
    let el = existing.get(k);
    if (el) {
      existing.delete(k);
      update(el, item);
    } else {
      el = create(item);
      el.dataset.key = k;
    }
    if (cursor !== el) {
      container.insertBefore(el, cursor);
    } else {
      cursor = cursor.nextSibling;
    }
  }
  for (const leftover of existing.values()) leftover.remove();
}

export function setTextIfChanged(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export function setValueIfNotFocused(el, value) {
  if (document.activeElement === el) return;
  if (el.value !== value) el.value = value;
}

export function toggleClass(el, cls, on) {
  if (on) el.classList.add(cls); else el.classList.remove(cls);
}

export function preserveScroll(container, fn) {
  const top = container.scrollTop;
  const left = container.scrollLeft;
  fn();
  container.scrollTop = top;
  container.scrollLeft = left;
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function h(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

import { T } from './i18n.js';

export function setName(entity, value, lang) {
  const key = lang === 'ar' ? 'ar' : 'en';
  const other = key === 'ar' ? 'en' : 'ar';
  const previous = entity.name?.[key] || '';
  const name = { en: entity.name?.en || '', ar: entity.name?.ar || '' };
  if (!name[other] || name[other] === previous) name[other] = value;
  name[key] = value;
  entity.name = name;
}

export function armDelete(button, lang, onConfirm) {
  if (button.classList.contains('arm')) {
    clearTimeout(button._armTimer);
    onConfirm();
    return;
  }
  const label = button.textContent;
  button.classList.add('arm');
  button.textContent = T.confirmDelete[lang];
  button._armTimer = setTimeout(() => {
    if (!button.isConnected) return;
    button.classList.remove('arm');
    button.textContent = label;
  }, 3000);
}

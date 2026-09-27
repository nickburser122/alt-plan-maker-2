import { biLabel } from '../core/bi.js';

export function lex(model, key, lang) {
  const entry = model.lexicon && model.lexicon[key];
  if (!entry) return key;
  return entry[lang] || entry.en;
}

export function roleLabel(model, roleId, lang) {
  const role = model.roles.find(r => r.id === roleId);
  if (!role) return roleId;
  return role.name[lang] || role.name.en;
}

export function siteClassLabel(model, classId, lang) {
  const cls = model.siteClasses.find(c => c.id === classId);
  if (!cls) return classId;
  return cls.name[lang] || cls.name.en;
}

export { biLabel };

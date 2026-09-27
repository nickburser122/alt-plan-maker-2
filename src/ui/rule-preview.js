const TEMPLATES = {
  'max-per-day': {
    en: p => `Nobody does more than ${p.n} ${Number(p.n) === 1 ? 'duty' : 'duties'} per day`,
    ar: p => `لا أحد يقوم بأكثر من ${p.n} مهمة في اليوم`
  },
  'max-per-window': {
    en: p => `No more than ${p.n} duties in any ${p.windowDays}-day window`,
    ar: p => `لا أكثر من ${p.n} مهام خلال أي ${p.windowDays} أيام`
  },
  'min-rest-days': {
    en: p => p.days === 1 ? 'Nobody works two days in a row' : `At least ${p.days} rest day(s) between duties`,
    ar: p => p.days === 1 ? 'لا أحد يعمل يومين متتاليين' : `حد أدنى ${p.days} يوم راحة بين المهام`
  },
  'max-consecutive-days': {
    en: p => `Nobody works more than ${p.days} days in a row`,
    ar: p => `لا أحد يعمل أكثر من ${p.days} أيام متتالية`
  },
  'min-consecutive-days': {
    en: p => `Duty runs are at least ${p.days} days long`,
    ar: p => `مدة المهمة لا تقل عن ${p.days} أيام`
  },
  'weekday-limit': {
    en: p => `At most ${p.max} duties on ${p.weekdayName}`,
    ar: p => `حد أقصى ${p.max} مهام يوم ${p.weekdayName}`
  },
  'unavailable-dates': {
    en: p => `Blocked on ${(p.dates || []).length} specific date(s)`,
    ar: p => `محظور في ${(p.dates || []).length} تاريخ محدد`
  },
  'role-qualification': {
    en: p => `Only people qualified as ${p.roleName || 'this role'} can fill it`,
    ar: p => `فقط المؤهلون كـ ${p.roleName || 'هذا الدور'} يمكنهم شغله`
  },
  'pairing': {
    en: p => `${p.aName || 'Person A'} and ${p.bName || 'person B'} always work together`,
    ar: p => `${p.aName || 'الفرد أ'} و ${p.bName || 'الفرد ب'} يعملان معًا دائمًا`
  },
  'separation': {
    en: p => `${p.aName || 'Person A'} and ${p.bName || 'person B'} never work together`,
    ar: p => `${p.aName || 'الفرد أ'} و ${p.bName || 'الفرد ب'} لا يعملان معًا أبدًا`
  },
  'cap-by-tag': {
    en: p => `No more than ${p.n} tagged "${p.tag}" on the same day`,
    ar: p => `لا أكثر من ${p.n} بوسم "${p.tag}" في نفس اليوم`
  },
  'distinct-sites-per-day': {
    en: () => `Nobody is sent to two different sites the same day`,
    ar: () => `لا أحد يُرسل إلى موقعين مختلفين في نفس اليوم`
  },
  'site-min-gap': {
    en: p => `Each site waits at least ${p.days} day(s) between visits`,
    ar: p => `كل موقع ينتظر ${p.days} يوم على الأقل بين الزيارات`
  },
  'site-target-count': {
    en: p => `Each site is visited ${p.count} time(s) in the horizon`,
    ar: p => `كل موقع تتم زيارته ${p.count} مرة خلال المدى`
  },
  'site-required-tag': {
    en: p => `Only resources tagged "${p.tag}" may serve matching sites`,
    ar: p => `فقط الموارد الموسومة بـ "${p.tag}" تخدم المواقع المطابقة`
  },
  'coverage-all-active': {
    en: () => `Every active site gets at least one visit`,
    ar: () => `كل موقع نشط يحصل على زيارة واحدة على الأقل`
  },
  'crew-cohesion': {
    en: p => `The same crew stays together for ${p.windowDays} days`,
    ar: p => `يبقى نفس الفريق معًا لمدة ${p.windowDays} أيام`
  },
  'crew-rotation': {
    en: p => `No identical crew repeats within ${p.days} days`,
    ar: p => `لا يتكرر نفس الفريق خلال ${p.days} أيام`
  },
  'crew-size-bounds': {
    en: p => `Crews are between ${p.min} and ${p.max} people`,
    ar: p => `حجم الفريق بين ${p.min} و ${p.max} أفراد`
  },
  'attribute-window': {
    en: p => `Same-day sites stay within ${p.maxSpread} of each other on ${p.attrName}`,
    ar: p => `مواقع اليوم نفسه تبقى ضمن ${p.maxSpread} في ${p.attrName}`
  },
  'attribute-cap': {
    en: p => `${p.attrName} per person per day never exceeds ${p.max}`,
    ar: p => `${p.attrName} لكل شخص في اليوم لا يتجاوز ${p.max}`
  },
  'attribute-affinity': {
    en: () => `People are matched toward their stated preference`,
    ar: () => `يتم توزيع الأفراد وفق تفضيلهم المعلن`
  }
};

const WEEKDAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
};

function enrich(params, lang, model) {
  const p = { ...params };
  const pick = entry => entry ? (entry[lang] || entry.en || '') : '';
  if (model) {
    const person = id => pick(model.resources?.find(r => r.id === id)?.name);
    p.aName = person(p.a);
    p.bName = person(p.b);
    p.roleName = pick(model.roles?.find(r => r.id === p.roleId)?.name);
    p.attrName = pick(model.attributes?.find(a => a.id === p.attr)?.label) || p.attr;
  } else {
    p.attrName = p.attr;
  }
  p.weekdayName = WEEKDAYS[lang][Number(p.weekday)] ?? p.weekday;
  return p;
}

export function rulePreview(rule, lang, model = null) {
  const tpl = TEMPLATES[rule.type];
  if (!tpl) return rule.type;
  const l = lang === 'ar' ? 'ar' : 'en';
  try {
    return tpl[l](enrich(rule.params || {}, l, model));
  } catch (e) {
    return rule.type;
  }
}

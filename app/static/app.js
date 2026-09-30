const $ = (id) => document.getElementById(id);
const form = $('patient-form');
const steps = [
  ['Давайте познакомимся', 'Начнём с основного. Это поможет учесть возраст и пол при подборе обследований.'],
  ['Как вы себя чувствуете?', 'Сначала — самое важное. Если заполняете анкету для ребёнка, отвечайте о его самочувствии.'],
  ['Ваша история здоровья', 'Расскажите о наблюдении у врача и прошлых обследованиях. Эти вопросы можно оставить без ответа.'],
  ['Семья и образ жизни', 'Расскажите о заболеваниях в семье, курении и условиях работы. Этот шаг можно пропустить.'],
  ['Репродуктивное здоровье', 'Дополнительные сведения для врача. Можно не отвечать на отдельные вопросы или пропустить шаг.'],
  ['Подготовка к обследованию', 'Лекарства и особенности, которые важно обсудить с врачом. Этот шаг можно пропустить.'],
  ['Проверьте ваши ответы', 'Всё готово. Вы можете вернуться к любому разделу и изменить ответы.'],
];
const reviewStep = steps.length - 1;
let fields = [];
let steps = [];
let rules = null;
let answers = {};
let step = 0;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const year = () => Number(answers.checkup_year || new Date().getFullYear());
const birthYear = () => answers.birth_date ? Number(answers.birth_date.slice(0, 4)) : undefined;
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
function visible(field) {
  const condition = field.show_if;
  if (!condition) return true;
  const age = year() - birthYear();
  return (!condition.sex || answers.sex === condition.sex) &&
    (!('age_min' in condition) || age >= condition.age_min) &&
    (!('age_max' in condition) || age <= condition.age_max);
}
function isUrgent() {
  return answers.urgent && answers.urgent !== 'none';
}
function defaults() {
  answers = {};
  for (const field of fields) if ('default' in field) answers[field.name] = field.default;
}
async function loadFields() {
  $('load-error').hidden = true;
  $('retry').hidden = true;
  try {
    const [f, s, r] = await Promise.all(['/fields', '/steps', '/rules'].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url} недоступен: ${response.status}`);
      return response.json();
    }));
    if (!Array.isArray(f) || !f.length || !Array.isArray(s) || !s.length || !r.packages) throw new Error('invalid schema');
    [fields, steps, rules] = [f, s, r];
    defaults();
    render();
  } catch (error) {
    console.error('Анкета не загрузилась:', error);
    $('fields').replaceChildren();
    $('next').disabled = true;
    $('load-error').textContent = 'Не удалось загрузить анкету. Проверьте подключение к приложению и попробуйте снова.';
    $('load-error').hidden = false;
    $('retry').hidden = false;
  }
}

/* ---------- поля ---------- */
function renderField(field) {
  const id = field.name.replaceAll('.', '-');
  const value = answers[field.name];
  const hint = field.hint || '';
  const title = escapeHtml(field.label) + (field.required ? ' <span class="required" aria-hidden="true">*</span>' : '');
  const description = hint ? ` aria-describedby="${id}-hint"` : '';
  const req = field.required ? 'required' : '';
  let input;
  const simpleInput = ['number', 'date', 'text'].includes(field.type);
  if (simpleInput) {
    const max = field.max === 'checkup_year' ? year() : field.max === 'today' ? today() : field.max;
    const min = field.section === 'screening' ? Math.max(field.min, birthYear()) : field.min === 'birth_date' ? answers.birth_date : field.min;
    const bounds = `${min !== undefined ? ` min="${escapeHtml(min)}"` : ''}${max !== undefined ? ` max="${escapeHtml(max)}"` : ''}`;
    const numeric = field.type === 'number' ? ` inputmode="${field.increment === 'any' ? 'decimal' : 'numeric'}" step="${field.increment || 1}"` : '';
    input = `<label for="${id}">${title}</label><input class="number-input" id="${id}" name="${field.name}" type="${field.type}"${numeric}${bounds} ${field.required ? 'required' : ''} value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(field.placeholder || (field.section === 'screening' ? 'Год' : ''))}"${description}>`;
  } else {
    input = `<legend>${title}</legend><div class="choices ${field.layout === 'stack' ? 'stack' : ''}">` + options(field).map(([option, label], index) => {
      const checked = field.type === 'multiselect' ? (value || []).includes(option) : value === option;
      return `<label class="choice"><input type="${field.type === 'multiselect' ? 'checkbox' : 'radio'}" id="${id}-${index}" name="${field.name}" value="${escapeHtml(option)}" ${checked ? 'checked' : ''} ${field.type === 'multiselect' ? '' : req}${description}><span>${escapeHtml(label)}</span></label>`;
    }).join('') + '</div>';
  }
  const tag = simpleInput ? 'div' : 'fieldset';
  return `<${tag} class="field" data-name="${field.name}">${input}${hint ? `<p class="hint" id="${id}-hint">${escapeHtml(hint)}</p>` : ''}</${tag}>`;
}
function render(focus = false) {
  $('step-title').textContent = steps[step][0];
  $('step-description').textContent = steps[step][1];
  $('step-counter').textContent = step === reviewStep ? 'ПРОВЕРКА ОТВЕТОВ' : `ШАГ ${String(step + 1).padStart(2, '0')} / ${String(reviewStep).padStart(2, '0')}`;
  $('progress-fill').style.width = `${Math.min(step + 1, reviewStep) / reviewStep * 100}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuemax', reviewStep);
  document.querySelector('.progress-track').setAttribute('aria-valuenow', Math.min(step + 1, reviewStep));
  document.querySelectorAll('.steps li').forEach((item, index) => {
    item.classList.toggle('completed', index < step);
    if (index === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  form.hidden = step === reviewStep;
  $('review').hidden = step !== reviewStep;
  if (step === reviewStep) renderReview();
  else {
    $('fields').innerHTML = fields.filter((field) => field.step === step && visible(field)).map(renderField).join('');
    $('back').hidden = step === 0;
    $('skip').hidden = step < 3;
    $('next').innerHTML = (step === reviewStep - 1 ? 'Проверить ответы' : 'Продолжить') + ' <span aria-hidden="true">→</span>';
    validateDates();
    updateSafety();
  }
  if (focus) $('step-title').focus();
}
function updateSafety() {
  const urgent = isUrgent();
  $('urgent-alert').hidden = !urgent;
  $('back').hidden = step === 0 || urgent;
  $('next').disabled = urgent;
  $('next').hidden = urgent;
  $('skip').hidden = step < 3 || urgent;
  // Keep the triggering choices editable; stop all remaining questions.
  let afterTrigger = false;
  for (const wrapper of $('fields').querySelectorAll('.field')) {
    wrapper.hidden = urgent && afterTrigger;
    wrapper.querySelectorAll('input').forEach((input) => { input.disabled = wrapper.hidden; });
    if (name === 'urgent') afterTrigger = true;
  }
}
form.addEventListener('input', (event) => {
  const input = event.target;
  const field = fields.find((f) => f.name === input.name);
  if (!field) return;
  const before = fields.filter(visible).map((f) => f.name).join() + JSON.stringify(fields.filter((f) => f.options_from).map((f) => answers[f.options_from]));
  if (field.type === 'multiselect') {
    let picked = Array.from(form.elements).filter((el) => el.name === field.name && el.checked).map((el) => el.value);
    if (field.exclusive && picked.includes(field.exclusive) && picked.length > 1) {
      picked = input.value === field.exclusive ? [field.exclusive] : picked.filter((v) => v !== field.exclusive);
    }
    answers[field.name] = picked;
  } else if (input.value === '') delete answers[field.name];
  else answers[field.name] = field.type === 'number' ? Number(input.value) : field.type === 'boolean' ? input.value === 'true' : input.value;
  // Ответы на вопросы, которые больше не показываются, — убираем
  for (const candidate of fields) if (!visible(candidate)) delete answers[candidate.name];
  validateDates();
  updateSafety();
});
function validateDates() {
  const birth = $('birth_date');
  if (birth) birth.setCustomValidity(birthYear() > year() ? 'Дата рождения не может быть позже года обследования.' : '');
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (isUrgent() || !form.reportValidity()) return;
  go(1);
});
$('back').addEventListener('click', () => go(-1));
$('skip').addEventListener('click', () => {
  if (isUrgent()) return;
  fields.filter((field) => field.step === step).forEach((field) => { delete answers[field.name]; });
  step += 1;
  render(true);
});
$('retry').addEventListener('click', loadFields);

/* ---------- вход для движка (spec/CONTRACT.md) ---------- */
function packYears() {
  if (!['smokes', 'quit'].includes(answers.smoke_status)) return 0;
  return (Number(answers.cigs_per_day) || 0) / 20 * (Number(answers.smoke_years) || 0);
}
const quitYears = () => (answers.smoke_status === 'quit' ? Number(answers.quit_years_ago) || 0 : 0);
function collectInput() {
  const payload = {};
  for (const field of fields.filter(visible)) {
    let value = answers[field.name];
    if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) continue;
    const path = field.name.split('.');
    let target = payload;
    for (const key of path.slice(0, -1)) target = target[key] ||= {};
    target[path.at(-1)] = value;
  }
  // Explicit default, including when the optional year was cleared.
  payload.checkup_year = year();
  if (birthYear() !== undefined) payload.birth_year = birthYear();
  return payload;
}
function displayValue(field) {
  const value = answers[field.name];
  if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) return 'Не указано';
  if (field.type === 'date') return new Date(value).toLocaleDateString('ru-RU');
  if (field.options) return field.options.filter(([option]) => Array.isArray(value) ? value.includes(option) : value === option).map(([, label]) => label).join('; ');
  if (field.type === 'date') return value.split('-').reverse().join('.');
  return String(value);
}
function renderReview() {
  $('review').innerHTML = '<p class="review-notice">Анкета заполнена. Подбор программы будет доступен позже. Сейчас можно проверить и изменить ответы.</p>' + steps.slice(0, reviewStep).map(([title], index) =>
    `<section class="review-section"><h3>${escapeHtml(title)}<button class="edit-button" type="button" data-edit="${index}" aria-label="Изменить раздел: ${escapeHtml(title)}">Изменить</button></h3><dl>` +
    fields.filter((field) => field.step === index && visible(field)).map((field) => `<dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(displayValue(field))}</dd>`).join('') + '</dl></section>'
  ).join('') + '<button id="restart" class="secondary-button" type="button">Заполнить заново</button>';
  $('review').querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    step = Number(button.dataset.edit);
    render(true);
  }));
  $('show-result').addEventListener('click', () => { step = resultStep(); render(true); });
  $('restart').addEventListener('click', () => { defaults(); step = 0; render(true); });
}

/* ---------- подбор программы: правила spec/rules.json ---------- */
// Названия скринингов простыми словами; медицинское название и пункт приказа — мелко, для врача
const PLAIN = {
  scr_cvd: ['Давление, сердце, сахар, глаза', 'анализы крови на холестерин и сахар, измерение давления в глазу'],
  scr_cerebro: ['Сосуды шеи и головы', 'УЗИ сосудов шеи'],
  scr_breast: ['Молочная железа', 'маммография'],
  scr_cervix: ['Шейка матки', 'мазок на онкоцитологию или ВПЧ'],
  scr_colorectal: ['Кишечник', 'анализ кала на скрытую кровь'],
  scr_hepatitis: ['Гепатиты B и C', 'анализ крови'],
  scr_lung: ['Лёгкие', 'КТ лёгких'],
};
const plainName = (s) => (PLAIN[s.id] || [s.name])[0];
const plainWhat = (s) => (PLAIN[s.id] || [null, s.stage1.filter((x) => !/^Приём/.test(x)).join(', ')])[1];
const label = (name, value) => fields.find((f) => f.name === name)?.options?.find(([v]) => v === value)?.[1];

function compute() {
  const a = answers, input = collectInput();
  const age = ageYear(), full = fullAge();
  const out = { free: [], notFree: [], pkg: null, pkgExams: [], extra: [], doctor: [], pregnant: false };
  out.pregnant = a.sex === 'F' && ['yes', 'unsure'].includes(a.pregnant);
  const reg = input.registered || [], last = Object.keys(input.last_screening || {});
  if (!a.for_child && age !== null) for (const s of rules.screening) {
    const w = s.when;
    if (w.sex && !w.sex.includes(a.sex)) continue;
    if (w.age_year && !w.age_year.includes(age)) continue;
    if (w.age_min != null && age < w.age_min) continue;
    if (!w.age_year && w.age_min == null) continue; // только по группе риска — вопроса в анкете нет
    if (w.not_pregnant && out.pregnant) { out.notFree.push({ s, why: 'при беременности — по отдельному порядку, обсудите с врачом' }); continue; }
    if (w.any_of && !w.any_of.some((c) => (c.pack_years_min != null && packYears() >= c.pack_years_min && quitYears() <= c.quit_years_max) ||
      (c.hazardous_work_10y && a.hazardous_work_10y === 'yes'))) continue;
    if ((w.not_registered || []).some((r) => reg.includes(r))) { out.notFree.push({ s, why: 'вы стоите на учёте — это обследование ведёт ваш врач' }); continue; }
    if (last.includes(s.id) && s.repeat_years >= 2) { out.notFree.push({ s, why: 'проходили в последние 2 года — повтор бесплатно пока не положен' }); continue; }
    out.free.push(s);
  }
  // Пакет клиники — по полным годам: ребёнок 1–17, базовый до 40, расширенный после 40
  const child = a.for_child || (full !== null && full < 18);
  out.pkg = rules.packages.find((p) => (child ? p.id === 'prime_child' : p.id !== 'prime_child' && full >= p.when.age_min && full <= p.when.age_max)) || null;
  if (out.pkg && out.pkg.id !== 'prime_child') {
    const overlap = new Set(out.free.flatMap((s) => s.prime_overlap || []));
    const freeNames = out.free.flatMap((s) => s.stage1.map((n) => n.toLowerCase()));
    const fully = (e) => freeNames.some((n) => n.startsWith(e.split('(')[0].trim().toLowerCase()));
    const list = [...out.pkg.exams, ...(a.sex === 'F' ? out.pkg.female_exams || [] : out.pkg.male_exams || [])];
    const flagged = new Map();
    for (const c of rules.complaints) {
      if (c.action === 'red_flag' || !c.when.family_history || !(a.family_history || []).includes(c.when.family_history)) continue;
      for (const e of c.exams || []) flagged.set(e, c);
    }
    out.pkgExams = list.map((e) => ({ exam: e, free: overlap.has(e) && fully(e), part: overlap.has(e) && !fully(e),
      preg: out.pregnant && /КТ|Маммограф|рентген/i.test(e), family: [...flagged.keys()].some((k) => e.toLowerCase().includes(k.split(' ')[0].toLowerCase())) }));
  }
  // Сверх пакета — по ответам; состав назначает врач, цена — по прайсу PRIME
  const inPkg = (word) => out.pkgExams.some((x) => x.exam.includes(word));
  if (a.discharge === 'yes') {
    out.extra.push({ exam: 'Обследование на половые инфекции', why: 'выделения, запах', note: 'состав назначает врач' });
    if (!inPkg('гинеколог')) out.extra.push({ exam: 'Консультация гинеколога', why: 'выделения, запах' });
  }
  if (a.dysuria === 'yes') {
    out.extra.push({ exam: 'Обследование на половые инфекции', why: 'боль при мочеиспускании, выделения', note: 'состав назначает врач' });
    if (!inPkg('уролог')) out.extra.push({ exam: 'Консультация уролога', why: 'боль при мочеиспускании, выделения' });
  }
  // Врачу — всё, что пациент рассказал о себе
  const shown = (name) => { const f = fields.find((x) => x.name === name); return f && visible(f) && a[name] !== undefined && a[name] !== ''; };
  const list = (name) => (a[name] || []).filter((v) => v !== 'none').map((v) => label(name, v)).filter(Boolean);
  if (list('conditions').length) out.doctor.push(`Есть или было: ${list('conditions').join('; ')}`);
  if (shown('conditions_other')) out.doctor.push(`Другое: ${a.conditions_other}`);
  if (list('registered_on').length) out.doctor.push(`На учёте: ${list('registered_on').join('; ')}`);
  if (list('family_history').length) out.doctor.push(`В семье: ${list('family_history').join('; ')}`);
  if ((a.family_history || []).includes('colorectal_cancer')) out.doctor.push('Рак кишечника в семье — обсудить колоноскопию раньше обычного возраста');
  if (shown('last_period')) out.doctor.push(`Последние месячные: ${new Date(a.last_period).toLocaleDateString('ru-RU')}`);
  if (out.pregnant) out.doctor.push(`Беременность: ${label('pregnant', a.pregnant)}`);
  if (shown('pregnancies')) out.doctor.push(`Беременностей: ${a.pregnancies}${shown('births') ? `, родов: ${a.births}` : ''}`);
  if (shown('contraception')) out.doctor.push(`Предохранение: ${label('contraception', a.contraception)}`);
  if (a.smoke_status && a.smoke_status !== 'never') out.doctor.push(`Курение: ${label('smoke_status', a.smoke_status)}${packYears() ? `, ≈ ${Math.round(packYears())} пачка-лет` : ''}`);
  if (a.anesthesia_reaction === 'yes') out.doctor.push('Были плохие реакции на наркоз');
  if (['yes', 'unknown'].includes(a.blood_thinners)) out.doctor.push(`Препараты, разжижающие кровь: ${label('blood_thinners', a.blood_thinners)}`);
  if (['yes', 'unknown'].includes(a.allergy)) out.doctor.push(`Аллергия на лекарства или контраст: ${label('allergy', a.allergy)}`);
  if (shown('medications') && String(a.medications).trim()) out.doctor.push(`Принимает сейчас: ${String(a.medications).trim()}`);
  return out;
}

function renderResult() {
  const r = compute(), a = answers, full = fullAge();
  const where = { green_clinic: 'в Green Clinic', other: 'в вашей поликлинике по прикреплению', unknown: 'в поликлинике по прикреплению — уточните его на egov.kz' }[a.attached_to] || 'в поликлинике по прикреплению';
  const li = (items) => `<ul>${items.join('')}</ul>`;
  let h = `<p class="review-notice">${a.for_child ? (a.sex === 'F' ? 'Девочка' : 'Мальчик') : (a.sex === 'F' ? 'Женщина' : 'Мужчина')}, ${full} ${plural(full)}. Программа — подсказка по правилам, не диагноз: итог обсудите с врачом.</p>`;

  if (!a.for_child) {
    h += `<section class="result-block free"><span class="result-label">1 · Положено бесплатно</span>`;
    if (r.free.length) {
      h += `<h3>По госпрограмме ${where}, в течение 60 дней</h3>` + li(r.free.map((s) =>
        `<li><b>${escapeHtml(plainName(s))}</b> — ${escapeHtml(plainWhat(s))}${r.pregnant && s.id === 'scr_breast' ? '<span class="tag warn">при беременности — обсудите с врачом</span>' : ''}<small class="src">${escapeHtml(s.name)} · ${escapeHtml(s.source)}</small></li>`));
    } else h += `<h3>В ${YEAR} году по возрасту бесплатный скрининг не положен</h3>`;
    if (r.notFree.length) h += li(r.notFree.map((x) => `<li class="muted">${escapeHtml(plainName(x.s))}: ${escapeHtml(x.why)}</li>`));
    h += '</section>';
  }

  h += `<section class="result-block paid"><span class="result-label">${a.for_child ? '1' : '2'} · Пакет PRIME</span>`;
  if (r.pkg?.id === 'prime_child') {
    h += `<h3>${escapeHtml(r.pkg.name_mini)}</h3>` + li(r.pkg.exams.map((e) => `<li>${escapeHtml(e)}</li>`)) +
      `<h3>${escapeHtml(r.pkg.name_extended)}</h3>` + li(r.pkg.extended_exams.map((e) => `<li>${escapeHtml(e)}</li>`)) +
      `<small class="src">Выбор между мини и расширенным — вместе с педиатром · <a href="${r.pkg.url_mini}" target="_blank" rel="noopener">мини</a> · <a href="${r.pkg.url_extended}" target="_blank" rel="noopener">расширенный</a></small>`;
  } else if (r.pkg) {
    const name = a.sex === 'F' ? r.pkg.name_f : r.pkg.name_m, url = a.sex === 'F' ? r.pkg.url_f : r.pkg.url_m;
    h += `<h3>${escapeHtml(name || r.pkg.name)}</h3>` + li(r.pkg.exams && r.pkgExams.map((x) => {
      if (x.free) return `<li class="muted">${escapeHtml(x.exam)} — положено бесплатно, в пакете не нужно</li>`;
      if (x.preg) return `<li class="muted">${escapeHtml(x.exam)} — не проводится при беременности<span class="tag warn">решает врач</span></li>`;
      return `<li>${escapeHtml(x.exam)}${x.part ? '<span class="tag">часть — бесплатно по скринингу</span>' : ''}${x.family ? '<span class="tag">важно: рак кишечника в семье</span>' : ''}</li>`;
    })) + `<small class="src">Состав — по сайту клиники, цена — по прайсу PRIME · <a href="${url}" target="_blank" rel="noopener">страница пакета</a></small>`;
  } else h += '<p class="muted">Для этого возраста пакета PRIME нет.</p>';
  h += '</section>';

  if (r.extra.length) {
    h += `<section class="result-block extra"><span class="result-label">Сверх пакета — по вашим ответам</span><h3>Дополнительно, отдельно от пакета</h3>` +
      li(r.extra.map((x) => `<li>${escapeHtml(x.exam)} <span class="muted">— ${escapeHtml(x.why)}</span>${x.note ? `<span class="tag warn">${escapeHtml(x.note)}</span>` : ''}</li>`)) +
      '<small class="src">Назначает врач на приёме; цена — по прайсу PRIME.</small></section>';
  }

  if (r.pkg && r.pkg.id !== 'prime_child') {
    const ex = r.pkgExams.filter((x) => !x.free && !x.preg).map((x) => x.exam).join(' | ');
    const route = rules.day_route_order.steps.filter((st) => {
      if (/КТ/.test(st)) return /КТ|Маммограф/.test(ex);
      if (/Эндоскоп/.test(st)) return /скопия/.test(ex);
      if (/УЗИ/.test(st)) return /УЗИ|ЭКГ|ЭхоКГ|УЗДГ/.test(ex);
      return true;
    });
    h += `<section class="result-block route"><span class="result-label">3 · Маршрут на один день</span><h3>В PRIME, по порядку</h3><ol>${route.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol><small class="src">Порядок — логистика, уточняется у клиники.</small></section>`;
    h += `<section class="result-block prep"><span class="result-label">Подготовка</span><h3>Как подготовиться</h3>${li(rules.prime_prep.steps.map((s) => `<li>${escapeHtml(s)}</li>`))}` +
      (a.companion === 'no' ? '<p class="tag warn block">Вы отметили, что проводить вас некому. После наркоза за руль нельзя — обсудите с клиникой, как быть.</p>' : '') +
      `<small class="src">${escapeHtml(rules.prime_prep.source)}</small></section>`;
  }

  if (r.doctor.length) h += `<section class="result-block doctor"><span class="result-label">Для врача</span><h3>Отмечено в анкете</h3>${li(r.doctor.map((d) => `<li>${escapeHtml(d)}</li>`))}</section>`;
  if (r.free.length) h += `<p class="next-visit"><b>Когда повторить бесплатно:</b> ${r.free.map((s) => `${escapeHtml(plainName(s))} — ${YEAR + s.repeat_years}`).join(' · ')}</p>`;
  h += '<div class="form-actions"><button id="to-review" class="back-button" type="button">← К ответам</button><button id="book" class="primary-button" type="button">Записаться в PRIME <span aria-hidden="true">→</span></button></div>' +
    '<p id="book-note" class="hint" role="status"></p>';
  $('result').innerHTML = h;
  $('to-review').addEventListener('click', () => { step = reviewStep(); render(true); });
  $('book').addEventListener('click', () => { $('book-note').textContent = 'Демо: здесь заявка уйдёт в контакт-центр PRIME вместе с этой программой.'; });
}
loadFields();

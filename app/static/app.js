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
let answers = {};
let step = 0;
let submitting = false;
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
  for (const field of fields) {
    if ('default' in field) answers[field.name] = field.default === 'current_year' ? new Date().getFullYear() : field.default;
  }
}
async function loadFields() {
  $('load-error').hidden = true;
  $('retry').hidden = true;
  try {
    const response = await fetch('/fields');
    if (!response.ok) throw new Error('fields unavailable');
    fields = await response.json();
    if (!Array.isArray(fields) || !fields.length) throw new Error('invalid schema');
    defaults();
    render();
  } catch {
    $('fields').replaceChildren();
    $('next').disabled = true;
    $('load-error').textContent = 'Не удалось загрузить анкету. Проверьте подключение к приложению и попробуйте снова.';
    $('load-error').hidden = false;
    $('retry').hidden = false;
  }
}
function renderField(field) {
  const id = field.name.replaceAll('.', '-');
  const value = answers[field.name];
  const hint = field.hint || (field.section === 'screening' ? 'Год последнего обследования. Не помните — оставьте пустым.' : '');
  const title = escapeHtml(field.label) + (field.required ? ' <span class="required" aria-hidden="true">*</span>' : '');
  const description = hint ? ` aria-describedby="${id}-hint"` : '';
  let input;
  const simpleInput = ['number', 'date', 'text'].includes(field.type);
  if (simpleInput) {
    const max = field.max === 'checkup_year' ? year() : field.max === 'today' ? today() : field.max;
    const min = field.section === 'screening' ? Math.max(field.min, birthYear()) : field.min === 'birth_date' ? answers.birth_date : field.min;
    const bounds = `${min !== undefined ? ` min="${escapeHtml(min)}"` : ''}${max !== undefined ? ` max="${escapeHtml(max)}"` : ''}`;
    const numeric = field.type === 'number' ? ` inputmode="${field.increment === 'any' ? 'decimal' : 'numeric'}" step="${field.increment || 1}"` : '';
    input = `<label for="${id}">${title}</label><input class="number-input" id="${id}" name="${field.name}" type="${field.type}"${numeric}${bounds} ${field.required ? 'required' : ''} value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(field.placeholder || (field.section === 'screening' ? 'Год' : ''))}"${description}>`;
  } else {
    input = `<legend>${title}</legend><div class="choices ${field.layout === 'stack' ? 'stack' : ''}">` + field.options.map(([option, label], index) => {
      const checked = field.type === 'multiselect' ? (value || []).includes(option) : value === option;
      return `<label class="choice"><input type="${field.type === 'multiselect' ? 'checkbox' : 'radio'}" id="${id}-${index}" name="${field.name}" value="${escapeHtml(option)}" ${checked ? 'checked' : ''} ${field.required ? 'required' : ''}${description}><span>${escapeHtml(label)}</span></label>`;
    }).join('') + '</div>';
  }
  const tag = simpleInput ? 'div' : 'fieldset';
  return `<${tag} class="field" data-name="${field.name}">${input}${hint ? `<p class="hint" id="${id}-hint">${escapeHtml(hint)}</p>` : ''}</${tag}>`;
}
function render(focus = false) {
  $('results-screen').hidden = true;
  $('recommendation').hidden = true;
  $('recommendation').replaceChildren();
  document.querySelector('.progress-track').hidden = false;
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
    let screeningHeader = false;
    $('fields').innerHTML = fields.filter((field) => field.step === step && visible(field)).map((field) => {
      let heading = '';
      if (field.section === 'screening' && !screeningHeader) {
        screeningHeader = true;
        heading = '<h3 class="screening-title">Прошлые обследования</h3><p class="hint screening-hint">Укажите год, если проходили эти обследования.</p>';
      }
      return heading + renderField(field);
    }).join('');
    $('back').hidden = step === 0;
    $('skip').hidden = step < 3;
    $('next').innerHTML = (step === reviewStep - 1 ? 'Проверить ответы' : 'Продолжить') + ' <span aria-hidden="true">→</span>';
    validateDates();
    updateSafety();
  }
  if (focus) $('step-title').focus();
}
function updateSafety() {
  const urgent = Boolean(isUrgent());
  $('urgent-alert').hidden = !urgent;
  $('back').hidden = step === 0 || urgent;
  $('next').disabled = urgent;
  $('next').hidden = urgent;
  $('skip').hidden = step < 3 || urgent;
  // Keep the triggering choices editable; stop all remaining questions.
  let afterTrigger = false;
  for (const wrapper of $('fields').querySelectorAll('.field')) {
    const name = wrapper.dataset.name;
    wrapper.hidden = urgent && afterTrigger;
    wrapper.querySelectorAll('input').forEach((input) => { input.disabled = wrapper.hidden; });
    if (name === 'urgent') afterTrigger = true;
  }
}
form.addEventListener('input', (event) => {
  const input = event.target;
  const field = fields.find((f) => f.name === input.name);
  if (!field) return;
  if (field.type === 'multiselect') {
    answers[field.name] = Array.from(form.elements).filter((el) => el.name === field.name && el.checked).map((el) => el.value);
  } else if (input.value === '') delete answers[field.name];
  else answers[field.name] = field.type === 'number' ? Number(input.value) : field.type === 'boolean' ? input.value === 'true' : input.value;
  // Drop answers when their conditional questions no longer apply.
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
  step += 1;
  render(true);
});
$('back').addEventListener('click', () => { step = Math.max(0, step - 1); render(true); });
$('skip').addEventListener('click', () => {
  if (isUrgent()) return;
  fields.filter((field) => field.step === step).forEach((field) => { delete answers[field.name]; });
  step += 1;
  render(true);
});
$('retry').addEventListener('click', loadFields);
$('results-back').addEventListener('click', () => {
  step = reviewStep;
  render(true);
  $('form-panel').scrollIntoView({ block: 'start' });
});
function collectInput() {
  const payload = {};
  for (const field of fields.filter(visible)) {
    const value = answers[field.name];
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
  const value = field.name === 'checkup_year' ? year() : answers[field.name];
  if (value === undefined || (Array.isArray(value) && !value.length)) return field.section === 'screening' ? 'Не указано / не помню' : 'Не указано';
  if (field.options) return field.options.filter(([option]) => Array.isArray(value) ? value.includes(option) : value === option).map(([, label]) => label).join('; ');
  if (field.type === 'date') return value.split('-').reverse().join('.');
  return String(value);
}
function renderReview() {
  $('review').innerHTML = '<p class="review-notice">Проверьте ответы и получите программу обследования по текущим правилам клиники.</p><button id="recommend" class="primary-button recommend-button" type="button">Подобрать программу <span aria-hidden="true">→</span></button><p id="recommend-status" class="hint" role="status" aria-live="polite"></p><p id="recommend-error" class="request-error" role="alert" hidden></p>' + steps.slice(0, reviewStep).map(([title], index) =>
    `<section class="review-section"><h3>${escapeHtml(title)}<button class="edit-button" type="button" data-edit="${index}" aria-label="Изменить раздел: ${escapeHtml(title)}">Изменить</button></h3><dl>` +
    fields.filter((field) => field.step === index && visible(field)).map((field) => `<dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(displayValue(field))}</dd>`).join('') + '</dl></section>'
  ).join('') + '<button id="restart" class="secondary-button" type="button">Заполнить заново</button>';
  $('review').querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    step = Number(button.dataset.edit);
    render(true);
  }));
  $('restart').addEventListener('click', () => { defaults(); step = 0; render(true); });
  $('recommend').addEventListener('click', submitRecommendation);
}

async function submitRecommendation() {
  if (submitting) return;
  submitting = true;
  const button = $('recommend');
  const controls = $('review').querySelectorAll('button');
  controls.forEach((control) => { control.disabled = true; });
  $('recommendation').hidden = true;
  $('recommendation').setAttribute('aria-busy', 'true');
  $('recommend-error').hidden = true;
  button.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> Подбираем программу…';
  $('recommend-status').textContent = 'Проверяем ответы и подбираем обследования по правилам клиники.';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/recommendations', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(collectInput()), signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Не удалось подобрать программу. Попробуйте снова.');
    if (!Array.isArray(data.items) || !Array.isArray(data.red_flags)) throw new Error('Сервер вернул неполный результат. Попробуйте снова.');
    renderRecommendation(data);
    $('recommend-status').textContent = 'Ответ сервера получен.';
    button.textContent = 'Подобрать ещё раз';
    form.hidden = true;
    $('review').hidden = true;
    $('results-screen').hidden = false;
    document.querySelector('.progress-track').hidden = true;
    $('step-counter').textContent = 'РЕЗУЛЬТАТ ПОДБОРА';
    $('step-title').textContent = 'Ваша программа обследования';
    $('step-description').textContent = 'Программа подобрана по вашим ответам. Состав обследований необходимо обсудить с врачом.';
    $('step-title').focus();
    $('form-panel').scrollIntoView({ block: 'start' });
  } catch (error) {
    $('recommend-status').textContent = '';
    $('recommend-error').textContent = error.name === 'AbortError'
      ? 'Сервер не ответил вовремя. Ответы сохранены в этой вкладке — попробуйте снова.'
      : error instanceof TypeError || error instanceof SyntaxError
        ? 'Не удалось получить программу. Проверьте подключение и попробуйте снова.' : error.message;
    $('recommend-error').hidden = false;
    button.textContent = 'Попробовать снова';
  } finally {
    clearTimeout(timeout);
    submitting = false;
    controls.forEach((control) => { control.disabled = false; });
    $('recommendation').setAttribute('aria-busy', 'false');
  }
}

function renderRecommendation(data) {
  const list = (values) => `<ul class="exam-list">${values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
  let html = '';
  if (data.red_flags.length) {
    html = `<div class="urgent-alert"><h3 id="result-title" tabindex="-1">Обратитесь за медицинской помощью</h3>${list(data.red_flags)}<a class="emergency-call" href="tel:103">Позвонить 103 ↗</a></div>`;
  } else {
    const pack = data.package;
    html = `<div class="package-card"><span class="eyebrow">ВАША ПРОГРАММА</span><h3 id="result-title" tabindex="-1">${escapeHtml(pack ? pack.name : 'Индивидуальная консультация')}</h3><p>${pack ? 'Платный пакет PRIME · ' + (pack.price == null ? 'Стоимость уточните в клинике' : escapeHtml(pack.price)) : 'Подходящего пакета в текущих правилах нет.'}</p><p class="hint">Возраст в году обследования: ${escapeHtml(data.age_year)}. Программу необходимо обсудить с врачом.</p></div>`;
    html += (data.warnings || []).map((warning) => `<p class="review-notice">${escapeHtml(warning)}</p>`).join('');
    if (pack) {
      const exams = data.items.filter((item) => item.rule_id === pack.id);
      html += '<section class="result-section"><h3>В составе пакета</h3><ul class="exam-list">' + exams.map((item) =>
        `<li>${escapeHtml(item.exam)}${item.highlights?.length ? `<p class="hint">Важно с учётом анкеты: ${escapeHtml(item.highlights.join('; '))}. Рекомендация клиники, уточните у врача.</p>` : ''}</li>`
      ).join('') + '</ul></section>';
    }
    if (data.screenings?.length) {
      html += '<section class="result-section"><h3>Бесплатные скрининги</h3><p class="hint">Доступны отдельно от платного пакета. Совпадающие обследования можно обсудить с врачом — обе возможности сохранены.</p>' + data.screenings.map((screening) =>
        `<article class="screening-card"><span class="result-badge">${screening.payment === 'free_osms' ? 'ОСМС' : 'ГОБМП'}</span><h4>${escapeHtml(screening.name)}</h4><p class="hint">${escapeHtml(screening.where)}</p>${list(screening.stage1)}${screening.stage2_note ? `<p class="hint">${escapeHtml(screening.stage2_note)}</p>` : ''}<p class="hint">Источник: ${escapeHtml(screening.source)}</p></article>`
      ).join('') + '</section>';
    }
    if (data.additions?.length) {
      html += '<section class="result-section"><h3>Сверх пакета</h3><p class="hint">Рекомендации клиники, уточните у врача. Услуги оплачиваются отдельно.</p>' + data.additions.map((item) =>
        `<article class="screening-card"><h4>${escapeHtml(item.name)}</h4><p class="hint">С учётом ответа: ${escapeHtml(item.why.join('; '))}.</p></article>`
      ).join('') + '</section>';
    }
    if (data.not_eligible?.length) {
      html += '<details class="result-section"><summary>Почему некоторые скрининги не предложены</summary>' + data.not_eligible.map((item) =>
        `<p class="hint"><strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(item.why)}</p>`
      ).join('') + '</details>';
    }
    if (data.preparation?.length) {
      html += '<details class="result-section"><summary>Подготовка к обследованию</summary>' + data.preparation.map((item) =>
        `<p class="hint"><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.text)}</p>`
      ).join('') + '</details>';
    }
  }
  $('recommendation').innerHTML = html;
  $('recommendation').hidden = false;
}
loadFields();

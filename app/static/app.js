const $ = (id) => document.getElementById(id);
const form = $('patient-form');
const steps = [
  ['Давайте познакомимся', 'Начнём с основного. Это поможет учесть возраст и пол при подборе обследований.'],
  ['Как вы себя чувствуете?', 'Сначала — самое важное. Если заполняете анкету для ребёнка, отвечайте о его самочувствии.'],
  ['Ваша история здоровья', 'Расскажите о наблюдении у врача и прошлых обследованиях. Эти вопросы можно оставить без ответа.'],
  ['Ещё немного о вас', 'Дополнительная информация, которую стоит обсудить с врачом. Этот шаг можно пропустить.'],
  ['Проверьте ваши ответы', 'Всё готово. Вы можете вернуться к любому разделу и изменить ответы.'],
];
let fields = [];
let answers = {};
let step = 0;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const year = () => Number(answers.checkup_year || new Date().getFullYear());
function visible(field) {
  const condition = field.show_if;
  if (!condition) return true;
  const age = year() - Number(answers.birth_year);
  return (!condition.sex || answers.sex === condition.sex) &&
    (!('age_min' in condition) || age >= condition.age_min) &&
    (!('age_max' in condition) || age <= condition.age_max);
}
function isUrgent() {
  return (answers.urgent && answers.urgent !== 'none') || (answers.complaints || []).includes('chest_pain');
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
  if (field.type === 'number') {
    const max = field.max === 'checkup_year' ? year() : field.max;
    const min = field.section === 'screening' ? Math.max(field.min, Number(answers.birth_year)) : field.min;
    input = `<label for="${id}">${title}</label><input class="number-input" id="${id}" name="${field.name}" type="number" inputmode="numeric" step="1" min="${min}" max="${max}" ${field.required ? 'required' : ''} value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(field.placeholder || 'Год')}"${description}>`;
  } else {
    input = `<legend>${title}</legend><div class="choices ${field.layout === 'stack' ? 'stack' : ''}">` + field.options.map(([option, label], index) => {
      const checked = field.type === 'multiselect' ? (value || []).includes(option) : value === option;
      return `<label class="choice"><input type="${field.type === 'multiselect' ? 'checkbox' : 'radio'}" id="${id}-${index}" name="${field.name}" value="${escapeHtml(option)}" ${checked ? 'checked' : ''} ${field.required ? 'required' : ''}${description}><span>${escapeHtml(label)}</span></label>`;
    }).join('') + '</div>';
  }
  const tag = field.type === 'number' ? 'div' : 'fieldset';
  return `<${tag} class="field" data-name="${field.name}">${input}${hint ? `<p class="hint" id="${id}-hint">${escapeHtml(hint)}</p>` : ''}</${tag}>`;
}
function render(focus = false) {
  $('step-title').textContent = steps[step][0];
  $('step-description').textContent = steps[step][1];
  $('step-counter').textContent = step === 4 ? 'ПРОВЕРКА ОТВЕТОВ' : `ШАГ 0${step + 1} / 04`;
  $('progress-fill').style.width = `${step === 4 ? 100 : (step + 1) * 25}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuenow', Math.min(step + 1, 4));
  document.querySelectorAll('.steps li').forEach((item, index) => {
    item.classList.toggle('completed', index < step);
    if (index === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
  form.hidden = step === 4;
  $('review').hidden = step !== 4;
  if (step === 4) renderReview();
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
    $('skip').hidden = step !== 3;
    $('next').innerHTML = (step === 3 ? 'Проверить ответы' : 'Продолжить') + ' <span aria-hidden="true">→</span>';
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
  $('skip').hidden = step !== 3 || urgent;
  // Keep the triggering choices editable; stop all remaining questions.
  let afterTrigger = false;
  for (const wrapper of $('fields').querySelectorAll('.field')) {
    const name = wrapper.dataset.name;
    wrapper.hidden = urgent && afterTrigger;
    wrapper.querySelectorAll('input').forEach((input) => { input.disabled = wrapper.hidden; });
    if (name === 'urgent' || name === 'complaints') afterTrigger = true;
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
  const birth = $('birth_year');
  if (birth) birth.setCustomValidity(answers.birth_year > year() ? 'Год рождения не может быть позже года обследования.' : '');
  updateSafety();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (isUrgent() || !form.reportValidity()) return;
  step += 1;
  render(true);
});
$('back').addEventListener('click', () => { step = Math.max(0, step - 1); render(true); });
$('skip').addEventListener('click', () => {
  if (isUrgent()) return;
  fields.filter((field) => field.step === 3).forEach((field) => { delete answers[field.name]; });
  step = 4;
  render(true);
});
$('retry').addEventListener('click', loadFields);
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
  return payload;
}
function displayValue(field) {
  const value = field.name === 'checkup_year' ? year() : answers[field.name];
  if (value === undefined || (Array.isArray(value) && !value.length)) return field.section === 'screening' ? 'Не указано / не помню' : 'Не указано';
  if (field.options) return field.options.filter(([option]) => Array.isArray(value) ? value.includes(option) : value === option).map(([, label]) => label).join('; ');
  return String(value);
}
function renderReview() {
  $('review').innerHTML = '<p class="review-notice">Анкета заполнена. Подбор программы будет доступен позже. Сейчас можно проверить и изменить ответы.</p>' + steps.slice(0, 4).map(([title], index) =>
    `<section class="review-section"><h3>${escapeHtml(title)}<button class="edit-button" type="button" data-edit="${index}" aria-label="Изменить раздел: ${escapeHtml(title)}">Изменить</button></h3><dl>` +
    fields.filter((field) => field.step === index && visible(field)).map((field) => `<dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(displayValue(field))}</dd>`).join('') + '</dl></section>'
  ).join('') + '<button id="restart" class="secondary-button" type="button">Заполнить заново</button>';
  $('review').querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => {
    step = Number(button.dataset.edit);
    render(true);
  }));
  $('restart').addEventListener('click', () => { defaults(); step = 0; render(true); });
}
loadFields();

const form = document.getElementById("patient-form");
const resultEl = document.getElementById("result");
const submitBtn = document.getElementById("submit-btn");

let fields = [];

async function loadFields() {
  const res = await fetch("/fields");
  fields = await res.json();
  renderForm();
}

function renderForm() {
  form.innerHTML = "";
  for (const f of fields) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const label = document.createElement("label");
    label.textContent = f.label;
    label.setAttribute("for", f.name);
    wrap.appendChild(label);

    if (f.type === "select") {
      const select = document.createElement("select");
      select.id = f.name;
      select.name = f.name;
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "—";
      select.appendChild(blank);
      for (const opt of f.options) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        select.appendChild(o);
      }
      wrap.appendChild(select);
    } else if (f.type === "multiselect") {
      const group = document.createElement("div");
      group.className = "checkbox-group";
      group.id = f.name;
      for (const opt of f.options) {
        const cbLabel = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = opt;
        cb.name = f.name;
        cbLabel.appendChild(cb);
        cbLabel.appendChild(document.createTextNode(opt));
        group.appendChild(cbLabel);
      }
      wrap.appendChild(group);
    } else {
      const input = document.createElement("input");
      input.type = f.type === "number" ? "number" : "text";
      input.id = f.name;
      input.name = f.name;
      wrap.appendChild(input);
    }

    form.appendChild(wrap);
  }
}

function setDeep(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = cur[parts[i]] || {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function collectInput() {
  const patient = {};
  for (const f of fields) {
    if (f.type === "multiselect") {
      const checked = Array.from(
        form.querySelectorAll(`input[name="${f.name}"]:checked`)
      ).map((el) => el.value);
      if (checked.length) setDeep(patient, f.name, checked);
    } else {
      const el = document.getElementById(f.name);
      if (!el || el.value === "") continue;
      const value = f.type === "number" ? Number(el.value) : el.value;
      setDeep(patient, f.name, value);
    }
  }
  return patient;
}

function renderResult(data) {
  resultEl.classList.remove("hidden");

  if (data.error) {
    resultEl.innerHTML = `<div class="error-box">Error: ${escapeHtml(data.error)}</div>`;
    return;
  }

  const reasons = (data.reasons || [])
    .map((r) => `<li>${escapeHtml(r.detail)}</li>`)
    .join("");

  resultEl.innerHTML = `
    <span class="badge ${escapeHtml(data.label || "")}">${escapeHtml(data.label || "?")}</span>
    <span> score ${data.score ?? "—"} · confidence ${escapeHtml(data.confidence || "—")}</span>
    ${data.needs_doctor_review ? `<div class="review-flag">Needs doctor review</div>` : ""}
    <ul class="reasons">${reasons}</ul>
    <div class="action">${escapeHtml(data.recommended_action || "")}</div>
    <div class="meta">model: ${escapeHtml(data.model_version || "—")}</div>
  `;
}

function renderLoading() {
  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `<div class="meta">Running…</div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function onSubmit() {
  submitBtn.disabled = true;
  renderLoading();
  try {
    const patient = collectInput();
    const res = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patient),
    });
    const data = await res.json();
    renderResult(data);
  } catch (err) {
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = `<div class="error-box">Request failed: ${escapeHtml(err.message)}</div>`;
  } finally {
    submitBtn.disabled = false;
  }
}

submitBtn.addEventListener("click", onSubmit);
loadFields();

"""
Single source of truth for the input form.
When the real task/data drop at T0, edit FIELDS below — the page
(/app/static/app.js) renders the form from this list automatically.

type: "number" | "text" | "select" | "multiselect"
"""

FIELDS = [
    {"name": "age", "label": "Age", "type": "number"},
    {"name": "sex", "label": "Sex", "type": "select", "options": ["m", "f"]},
    {"name": "symptoms", "label": "Symptoms", "type": "multiselect",
     "options": ["chest_pain", "shortness_of_breath", "dizziness", "mild_headache"]},
    {"name": "history", "label": "History", "type": "multiselect",
     "options": ["hypertension", "diabetes"]},
    {"name": "vitals.hr", "label": "Heart rate", "type": "number"},
    {"name": "vitals.sbp", "label": "Systolic BP", "type": "number"},
    {"name": "vitals.spo2", "label": "SpO2", "type": "number"},
    {"name": "free_text", "label": "Notes", "type": "text"},
]

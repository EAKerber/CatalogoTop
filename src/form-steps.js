(function () {
  'use strict';

  const form = document.getElementById('productForm');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('[data-form-step]'));
  const stepButtons = Array.from(form.querySelectorAll('[data-form-step-target]'));
  const prev = document.getElementById('btnPrevFormStep');
  const next = document.getElementById('btnNextFormStep');
  const save = document.getElementById('btnSaveProduct');
  const counter = document.getElementById('formStepCounter');
  let current = 1;

  function validateStep(stepNumber) {
    const step = steps.find(item => Number(item.dataset.formStep) === stepNumber);
    if (!step) return true;
    const required = Array.from(step.querySelectorAll('[required]'));
    for (const field of required) {
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    return true;
  }

  function show(stepNumber, options = {}) {
    const target = Math.min(steps.length, Math.max(1, Number(stepNumber) || 1));
    current = target;
    steps.forEach(step => step.classList.toggle('active', Number(step.dataset.formStep) === current));
    stepButtons.forEach(button => {
      const number = Number(button.dataset.formStepTarget);
      button.classList.toggle('active', number === current);
      button.classList.toggle('done', number < current);
      button.setAttribute('aria-current', number === current ? 'step' : 'false');
    });
    if (counter) counter.textContent = `Etapa ${current} de ${steps.length}`;
    if (prev) prev.classList.toggle('hidden', current === 1);
    if (next) next.classList.toggle('hidden', current === steps.length);
    if (save) save.classList.toggle('hidden', current !== steps.length);
    if (options.focus) {
      const first = steps.find(step => Number(step.dataset.formStep) === current)?.querySelector('input:not([type="hidden"]), textarea, select');
      first?.focus();
    }
  }

  prev?.addEventListener('click', () => show(current - 1));
  next?.addEventListener('click', () => {
    if (validateStep(current)) show(current + 1, { focus: true });
  });

  stepButtons.forEach(button => button.addEventListener('click', () => {
    const target = Number(button.dataset.formStepTarget);
    if (target > current && !validateStep(current)) return;
    show(target);
  }));

  // Carregado antes de app.js: Enter nas etapas 1/2 avança em vez de salvar prematuramente.
  form.addEventListener('submit', event => {
    if (current < steps.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (validateStep(current)) show(current + 1, { focus: true });
      return;
    }
    setTimeout(() => show(1), 0);
  });

  ['btnNewProduct', 'btnCancelEdit'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => show(1));
  });
  document.getElementById('productRows')?.addEventListener('click', event => {
    if (event.target.closest('[data-edit-product]')) show(1);
  });

  show(1);
})();

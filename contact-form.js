/* Same-origin relay confirms Google Sheets delivery before resetting the form. */
(() => {
  'use strict';
  const form = document.querySelector('#briefForm');
  if (!form) return;
  const ar = document.documentElement.lang === 'ar';
  const copy = ar ? {
    required:'يرجى تعبئة هذا الحقل.', email:'يرجى إدخال بريد إلكتروني صحيح.',
    long:'يرجى تقليل طول هذا الحقل.', short:'يرجى إضافة تفاصيل أكثر.', phone:'يرجى إدخال رقم تواصل صحيح.',
    invalid:'يرجى مراجعة الحقول المشار إليها.', sending:'جارٍ الإرسال…',
    sent:'شكراً لكم. تم إرسال استفساركم بنجاح إلى خدمة التواصل لدى الموند.',
    failed:'تعذّر تأكيد الإرسال. احتفظنا برسالتكم هنا؛ يرجى المحاولة مجدداً أو استخدام رابط التواصل الرسمي.',
    limited:'يرجى الانتظار قليلاً قبل إعادة الإرسال.', spam:'تعذّر إرسال هذا الطلب. يرجى تحديث الصفحة والمحاولة مجدداً.'
  } : {
    required:'Please complete this field.', email:'Enter a valid email address.',
    long:'Please shorten this field.', short:'Please add a little more detail.', phone:'Enter a valid phone number.',
    invalid:'Please review the highlighted fields.', sending:'Sending…',
    sent:'Thank you. Your enquiry has been submitted successfully to Almond’s contact service.',
    failed:'We could not confirm delivery. Your message is still here; please retry or use the official contact link.',
    limited:'Please wait a moment before submitting again.', spam:'This request could not be sent. Please reload and try again.'
  };
  const fields = [...form.querySelectorAll('input:not([name="_gotcha"]), select, textarea')];
  const status = document.querySelector('#formStatus');
  const button = document.querySelector('#submitEnquiry');
  const label = button.querySelector('[data-t]');
  const idleLabel = label.textContent;
  let pending = false;
  form.noValidate = true;
  function errorFor(field) {
    const value = field.value.trim();
    if (field.required && !value) return copy.required;
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return copy.email;
    if (field.name === 'phone' && value && !/^[+()\d\s.-]{7,40}$/.test(value)) return copy.phone;
    if (field.maxLength > 0 && field.value.length > field.maxLength) return copy.long;
    if (value && field.minLength > 0 && value.length < field.minLength) return copy.short;
    return '';
  }
  function validate(field) {
    const message = errorFor(field);
    field.setAttribute('aria-invalid', String(Boolean(message)));
    document.getElementById('error-' + field.name).textContent = message;
    return !message;
  }
  function announce(message, state) {
    status.textContent = message;
    status.dataset.state = state;
    document.dispatchEvent(new Event('almond:layout'));
  }
  fields.forEach(field => {
    field.addEventListener('blur', () => { if (field.value || field.getAttribute('aria-invalid') === 'true') validate(field); });
    field.addEventListener('input', () => { if (field.getAttribute('aria-invalid') === 'true') validate(field); });
    field.addEventListener('change', () => { if (field.getAttribute('aria-invalid') === 'true') validate(field); });
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    const valid = fields.map(validate).every(Boolean);
    if (!valid) { announce(copy.invalid, 'error'); fields.find(field => field.getAttribute('aria-invalid') === 'true')?.focus(); return; }
    if (form.querySelector('[name="_gotcha"]').value) { announce(copy.spam, 'error'); return; }
    const data = new FormData(form);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    pending = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    label.textContent = copy.sending;
    announce(copy.sending, 'pending');
    try {
      const response = await fetch(form.action, { method:'POST', body:data, headers:{ Accept:'application/json' }, signal:controller.signal });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || result.ok !== true || result.saved !== true) {
        announce(response.status === 429 ? copy.limited : copy.failed, 'error');
        return;
      }
      form.reset();
      fields.forEach(field => { field.removeAttribute('aria-invalid'); document.getElementById('error-' + field.name).textContent = ''; });
      announce(copy.sent, 'success');
    } catch {
      announce(copy.failed, 'error');
    } finally {
      clearTimeout(timeout);
      pending = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
      label.textContent = idleLabel;
    }
  });
})();

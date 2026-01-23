/**
 * Forgot Password View
 * Renders the forgot password form and handles password reset requests.
 */

import { h } from '../lib/dom.js';
import { navigate } from '../lib/router.js';
import { t } from '../lib/i18n.js';

export async function renderForgotPassword(root) {
  const container = h('div', { class: 'login-container' });

  const card = h('sl-card', { class: 'login-card' }, [
    h('div', { slot: 'header' }, [
      h('h2', { class: 'login-title' }, [t('forgotPassword.title')]),
      h('p', { class: 'login-subtitle' }, [t('forgotPassword.help')]),
    ]),

    h('form', { class: 'login-form', onsubmit: handleSubmit }, [
      h('sl-input', {
        id: 'email',
        type: 'email',
        label: t('forgotPassword.emailLabel'),
        placeholder: t('forgotPassword.emailPlaceholder'),
        autocomplete: 'email',
        required: true,
      }),

      h('div', { id: 'status', class: 'login-status' }),

      h('sl-button', {
        id: 'submit-btn',
        type: 'submit',
        variant: 'primary',
        class: 'login-submit',
      }, [t('forgotPassword.submit')]),

      h('sl-button', {
        variant: 'text',
        class: 'login-link',
        onclick: (e) => {
          e.preventDefault();
          navigate('/login');
        },
      }, [t('forgotPassword.backToLogin')]),
    ]),
  ]);

  container.appendChild(card);
  root.appendChild(container);

  // Add styles
  const style = h('style', {}, [`
    .login-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      padding: var(--sl-spacing-large);
    }
    .login-card {
      width: 100%;
      max-width: 400px;
    }
    .login-card::part(base) {
      background: var(--sl-panel-background-color);
    }
    .login-title {
      margin: 0;
      font-size: var(--sl-font-size-x-large);
      font-weight: var(--sl-font-weight-semibold);
    }
    .login-subtitle {
      margin: var(--sl-spacing-small) 0 0;
      color: var(--sl-color-neutral-600);
      font-size: var(--sl-font-size-small);
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: var(--sl-spacing-medium);
    }
    .login-submit {
      margin-top: var(--sl-spacing-small);
    }
    .login-submit::part(base) {
      width: 100%;
    }
    .login-link::part(base) {
      width: 100%;
    }
    .login-status {
      font-size: var(--sl-font-size-small);
      min-height: 1.5em;
    }
    .login-status.is-error {
      color: var(--sl-color-danger-600);
    }
    .login-status.is-success {
      color: var(--sl-color-success-600);
    }
  `]);
  root.appendChild(style);

  // Focus email input
  setTimeout(() => {
    const emailInput = root.querySelector('#email');
    if (emailInput) emailInput.focus();
  }, 100);

  async function handleSubmit(e) {
    e.preventDefault();

    const emailInput = root.querySelector('#email');
    const statusEl = root.querySelector('#status');
    const submitBtn = root.querySelector('#submit-btn');

    const email = emailInput?.value?.trim() || '';

    if (!email || !email.includes('@')) {
      statusEl.textContent = t('forgotPassword.errorInvalidEmail');
      statusEl.className = 'login-status is-error';
      return;
    }

    statusEl.textContent = t('forgotPassword.sending');
    statusEl.className = 'login-status';
    submitBtn.loading = true;
    emailInput.disabled = true;

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        statusEl.textContent = t('forgotPassword.success');
        statusEl.className = 'login-status is-success';
        emailInput.value = '';
      } else {
        statusEl.textContent = data.error || t('forgotPassword.error');
        statusEl.className = 'login-status is-error';
      }
    } catch {
      statusEl.textContent = t('forgotPassword.error');
      statusEl.className = 'login-status is-error';
    } finally {
      submitBtn.loading = false;
      emailInput.disabled = false;
    }
  }
}

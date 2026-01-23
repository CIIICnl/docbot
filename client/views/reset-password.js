/**
 * Reset Password View
 * Renders the password reset form and handles password reset.
 */

import { h } from '../lib/dom.js';
import { navigate } from '../lib/router.js';
import { t } from '../lib/i18n.js';

export async function renderResetPassword(root) {
  const url = new URL(location.href);
  const token = url.searchParams.get('token');

  const container = h('div', { class: 'login-container' });

  const card = h('sl-card', { class: 'login-card' }, [
    h('div', { slot: 'header' }, [
      h('h2', { class: 'login-title' }, [t('resetPassword.title')]),
      h('p', { id: 'subtitle', class: 'login-subtitle' }, [t('resetPassword.validating')]),
    ]),

    h('div', { id: 'form-container', class: 'login-form' }),
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

  const subtitleEl = root.querySelector('#subtitle');
  const formContainer = root.querySelector('#form-container');

  if (!token) {
    subtitleEl.textContent = t('resetPassword.invalidToken');
    formContainer.appendChild(
      h('sl-button', {
        variant: 'primary',
        class: 'login-submit',
        onclick: () => navigate('/login'),
      }, [t('resetPassword.goToLogin')])
    );
    return;
  }

  // Validate token
  try {
    const res = await fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
    const data = await res.json();

    if (!data.ok) {
      subtitleEl.textContent =
        data.reason === 'expired'
          ? t('resetPassword.expiredToken')
          : t('resetPassword.invalidToken');

      formContainer.appendChild(
        h('sl-button', {
          variant: 'primary',
          class: 'login-submit',
          onclick: () => navigate('/forgot-password'),
        }, [t('resetPassword.requestNew')])
      );
      return;
    }

    // Token is valid - show password form
    subtitleEl.textContent = t('resetPassword.resetFor').replace('{email}', data.maskedEmail);

    const form = h('form', { onsubmit: handleSubmit }, [
      h('sl-input', {
        id: 'password',
        type: 'password',
        label: t('resetPassword.passwordLabel'),
        placeholder: t('resetPassword.passwordPlaceholder'),
        autocomplete: 'new-password',
        required: true,
        'password-toggle': true,
      }),

      h('sl-input', {
        id: 'confirm-password',
        type: 'password',
        label: t('resetPassword.confirmLabel'),
        placeholder: t('resetPassword.confirmPlaceholder'),
        autocomplete: 'new-password',
        required: true,
        'password-toggle': true,
      }),

      h('div', { id: 'status', class: 'login-status' }),

      h('sl-button', {
        id: 'submit-btn',
        type: 'submit',
        variant: 'primary',
        class: 'login-submit',
      }, [t('resetPassword.submit')]),
    ]);

    formContainer.appendChild(form);

    // Focus password input
    setTimeout(() => {
      const passwordInput = root.querySelector('#password');
      if (passwordInput) passwordInput.focus();
    }, 100);

    async function handleSubmit(e) {
      e.preventDefault();

      const passwordInput = root.querySelector('#password');
      const confirmInput = root.querySelector('#confirm-password');
      const statusEl = root.querySelector('#status');
      const submitBtn = root.querySelector('#submit-btn');

      const password = passwordInput?.value || '';
      const confirmPassword = confirmInput?.value || '';

      // Validate
      if (password.length < 8) {
        statusEl.textContent = t('resetPassword.passwordTooShort');
        statusEl.className = 'login-status is-error';
        return;
      }

      if (password !== confirmPassword) {
        statusEl.textContent = t('resetPassword.passwordMismatch');
        statusEl.className = 'login-status is-error';
        return;
      }

      statusEl.textContent = t('resetPassword.resetting');
      statusEl.className = 'login-status';
      submitBtn.loading = true;
      passwordInput.disabled = true;
      confirmInput.disabled = true;

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        });

        const result = await res.json();

        if (res.ok) {
          // Success - show message and login button
          formContainer.innerHTML = '';
          formContainer.appendChild(
            h('div', { class: 'login-status is-success', style: 'margin-bottom: var(--sl-spacing-medium);' }, [
              t('resetPassword.success'),
            ])
          );
          formContainer.appendChild(
            h('sl-button', {
              variant: 'primary',
              class: 'login-submit',
              onclick: () => navigate('/login'),
            }, [t('resetPassword.goToLogin')])
          );
        } else {
          statusEl.textContent = result.error || t('resetPassword.error');
          statusEl.className = 'login-status is-error';
          submitBtn.loading = false;
          passwordInput.disabled = false;
          confirmInput.disabled = false;
        }
      } catch {
        statusEl.textContent = t('resetPassword.error');
        statusEl.className = 'login-status is-error';
        submitBtn.loading = false;
        passwordInput.disabled = false;
        confirmInput.disabled = false;
      }
    }
  } catch {
    subtitleEl.textContent = t('resetPassword.error');
    formContainer.appendChild(
      h('sl-button', {
        variant: 'primary',
        class: 'login-submit',
        onclick: () => navigate('/login'),
      }, [t('resetPassword.goToLogin')])
    );
  }
}

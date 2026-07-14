/**
 * Login View
 * Renders the login form and handles authentication.
 */

import { h } from '../lib/dom.js';
import { login, me, devLogin, isDevBypassAvailable } from '../lib/auth.js';
import { navigate } from '../lib/router.js';
import { t } from '../lib/i18n.js';

export async function renderLogin(root) {
  const url = new URL(location.href);
  const returnToRaw = url.searchParams.get('returnTo') || '';
  const returnTo = returnToRaw.startsWith('/') && !returnToRaw.startsWith('//')
    ? returnToRaw
    : '/';

  // Check if already logged in
  try {
    const user = await me();
    if (user) {
      navigate(returnTo);
      return;
    }
  } catch {
    // ignore
  }

  const container = h('div', { class: 'login-container' });

  const card = h('sl-card', { class: 'login-card' }, [
    h('div', { slot: 'header' }, [
      h('h2', { class: 'login-title' }, [t('login.title')]),
    ]),

    // CIIIC single sign-on (ZITADEL) — links to the server OIDC kickoff.
    h('a', { class: 'login-sso', href: '/auth/login' }, ['Inloggen met CIIIC']),
    h('sl-divider', {}),

    h('form', { class: 'login-form', onsubmit: handleSubmit }, [
      h('sl-input', {
        id: 'email',
        type: 'email',
        label: t('login.emailLabel'),
        placeholder: t('login.emailPlaceholder'),
        autocomplete: 'username',
        required: true,
      }),

      h('sl-input', {
        id: 'password',
        type: 'password',
        label: t('login.passwordLabel'),
        placeholder: t('login.passwordPlaceholder'),
        autocomplete: 'current-password',
        required: true,
        'password-toggle': true,
      }),

      h('div', { id: 'login-status', class: 'login-status' }),

      h('sl-button', {
        id: 'login-btn',
        type: 'submit',
        variant: 'primary',
        class: 'login-submit',
      }, [t('login.submit')]),

      h('sl-button', {
        variant: 'text',
        class: 'login-link',
        onclick: (e) => {
          e.preventDefault();
          navigate('/forgot-password');
        },
      }, [t('login.forgotPassword')]),

      h('sl-button', {
        id: 'dev-btn',
        variant: 'text',
        class: 'login-dev',
        style: 'display: none',
        onclick: handleDevLogin,
      }, [t('login.devBypass')]),
    ]),

    // Magic link section
    h('sl-divider', {}),
    h('div', { class: 'login-magic-section' }, [
      h('p', { class: 'login-magic-text' }, [t('login.orMagicLink')]),
      h('form', { class: 'login-form', onsubmit: handleMagicLink }, [
        h('sl-input', {
          id: 'magic-email',
          type: 'email',
          label: t('login.emailLabel'),
          placeholder: t('login.emailPlaceholder'),
          autocomplete: 'email',
          required: true,
        }),

        h('div', { id: 'magic-status', class: 'login-status' }),

        h('sl-button', {
          id: 'magic-btn',
          type: 'submit',
          variant: 'default',
          class: 'login-submit',
        }, [t('login.sendMagicLink')]),
      ]),
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
    .login-form {
      display: flex;
      flex-direction: column;
      gap: var(--sl-spacing-medium);
    }
    .login-sso {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 0.7rem 1rem;
      margin-bottom: var(--sl-spacing-small);
      background: var(--color-lime, #b6f500);
      color: #0a0a0a;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
    }
    .login-sso:hover {
      opacity: 0.9;
    }
    .login-submit {
      margin-top: var(--sl-spacing-small);
    }
    .login-submit::part(base) {
      width: 100%;
    }
    .login-dev::part(base) {
      width: 100%;
    }
    .login-link::part(base) {
      width: 100%;
    }
    .login-status {
      color: var(--sl-color-danger-600);
      font-size: var(--sl-font-size-small);
      min-height: 1.5em;
    }
    .login-status.is-success {
      color: var(--sl-color-success-600);
    }
    .login-magic-section {
      margin-top: var(--sl-spacing-small);
    }
    .login-magic-text {
      text-align: center;
      color: var(--sl-color-neutral-600);
      font-size: var(--sl-font-size-small);
      margin: 0 0 var(--sl-spacing-medium);
    }
  `]);
  root.appendChild(style);

  // Check if dev bypass is available
  const devBypassAvailable = await isDevBypassAvailable();
  if (devBypassAvailable) {
    const devBtn = root.querySelector('#dev-btn');
    if (devBtn) devBtn.style.display = 'block';
  }

  // Focus email input
  setTimeout(() => {
    const emailInput = root.querySelector('#email');
    if (emailInput) emailInput.focus();
  }, 100);

  async function handleSubmit(e) {
    e.preventDefault();

    const emailInput = root.querySelector('#email');
    const passwordInput = root.querySelector('#password');
    const statusEl = root.querySelector('#login-status');
    const submitBtn = root.querySelector('#login-btn');

    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';

    if (!email || !password) {
      statusEl.textContent = t('login.errorRequired');
      return;
    }

    statusEl.textContent = t('login.signingIn');
    submitBtn.loading = true;
    emailInput.disabled = true;
    passwordInput.disabled = true;

    try {
      await login(email, password);
      navigate(returnTo);
    } catch (err) {
      statusEl.textContent = err.message || t('login.errorFailed');
      submitBtn.loading = false;
      emailInput.disabled = false;
      passwordInput.disabled = false;
    }
  }

  async function handleDevLogin(e) {
    e.preventDefault();

    const statusEl = root.querySelector('#login-status');
    const devBtn = root.querySelector('#dev-btn');

    statusEl.textContent = t('login.devLogin');
    devBtn.loading = true;

    try {
      await devLogin();
      navigate(returnTo);
    } catch (err) {
      statusEl.textContent = err.message || t('login.devLoginFailed');
      devBtn.loading = false;
    }
  }

  async function handleMagicLink(e) {
    e.preventDefault();

    const emailInput = root.querySelector('#magic-email');
    const statusEl = root.querySelector('#magic-status');
    const submitBtn = root.querySelector('#magic-btn');

    const email = emailInput?.value?.trim() || '';

    if (!email || !email.includes('@')) {
      statusEl.textContent = t('login.errorInvalidEmail');
      statusEl.className = 'login-status';
      return;
    }

    statusEl.textContent = t('login.sendingMagicLink');
    statusEl.className = 'login-status';
    submitBtn.loading = true;
    emailInput.disabled = true;

    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        statusEl.textContent = t('login.magicLinkSent');
        statusEl.className = 'login-status is-success';
        emailInput.value = '';
      } else {
        statusEl.textContent = data.error || t('login.magicLinkError');
        statusEl.className = 'login-status';
      }
    } catch {
      statusEl.textContent = t('login.magicLinkError');
      statusEl.className = 'login-status';
    } finally {
      submitBtn.loading = false;
      emailInput.disabled = false;
    }
  }
}

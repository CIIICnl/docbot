/**
 * Magic Login View
 * Handles magic link verification and automatic login.
 */

import { h } from '../lib/dom.js';
import { navigate } from '../lib/router.js';
import { t } from '../lib/i18n.js';

export async function renderMagicLogin(root) {
  const url = new URL(location.href);
  const token = url.searchParams.get('token');

  const container = h('div', { class: 'login-container' });

  const card = h('sl-card', { class: 'login-card' }, [
    h('div', { slot: 'header' }, [
      h('h2', { class: 'login-title' }, [t('magicLogin.title')]),
      h('p', { id: 'status', class: 'login-subtitle' }, [t('magicLogin.verifying')]),
    ]),

    h('div', { id: 'action-container', class: 'login-form' }),
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

  const statusEl = root.querySelector('#status');
  const actionContainer = root.querySelector('#action-container');

  if (!token) {
    statusEl.textContent = t('magicLogin.invalidLink');
    actionContainer.appendChild(
      h('sl-button', {
        variant: 'primary',
        class: 'login-submit',
        onclick: () => navigate('/login'),
      }, [t('magicLogin.goToLogin')])
    );
    return;
  }

  // Verify the magic link token
  try {
    const res = await fetch('/api/auth/magic-link/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();

    if (data.ok) {
      // Success - redirect to home
      statusEl.textContent = t('magicLogin.success');
      statusEl.className = 'login-subtitle';

      // Small delay before redirect
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } else {
      // Show error
      statusEl.textContent =
        data.reason === 'expired'
          ? t('magicLogin.expiredLink')
          : t('magicLogin.invalidLink');

      actionContainer.appendChild(
        h('sl-button', {
          variant: 'primary',
          class: 'login-submit',
          onclick: () => navigate('/login'),
        }, [t('magicLogin.goToLogin')])
      );
    }
  } catch {
    statusEl.textContent = t('magicLogin.error');
    actionContainer.appendChild(
      h('sl-button', {
        variant: 'primary',
        class: 'login-submit',
        onclick: () => navigate('/login'),
      }, [t('magicLogin.goToLogin')])
    );
  }
}

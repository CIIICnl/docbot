/**
 * DreamDocs Application
 * Convert Notion pages and markdown to beautifully styled PDFs.
 */

import { route, notFound, startRouter, navigate } from './lib/router.js';
import { initTheme, createThemeToggle } from './lib/theme.js';
import { $, h, empty } from './lib/dom.js';
import { renderConverter } from './views/converter/index.js';
import { renderSettings } from './views/settings.js';
import { renderLogin } from './views/login.js';
import { getMeCached, logout, clearUserCache } from './lib/auth.js';
import { initI18n, t } from './lib/i18n.js';

// Initialize app
(async function init() {
  // Initialize theme and i18n
  initTheme();
  await initI18n();

  // Get app container
  const app = $('#app');

  // Current user state
  let currentUser = null;

  /**
   * Render the app shell with content
   */
  function renderShell(content, { activeNav = '' } = {}) {
    empty(app);

    // Using the header shell variant
    const shell = h('div', { class: 'vk-shell-header' }, [
      // Header
      h('header', { class: 'vk-header' }, [
        h('a', { href: '/', class: 'vk-header-logo' }, [t('common.appName')]),

        h('nav', { class: 'vk-header-nav' }, [
          h('a', {
            href: '/',
            class: activeNav === 'convert' ? 'is-active' : '',
          }, [t('nav.convert')]),
          h('a', {
            href: '/settings',
            class: activeNav === 'settings' ? 'is-active' : '',
          }, [t('nav.settings')]),
        ]),

        h('div', { class: 'vk-header-spacer' }),

        h('div', { class: 'vk-header-actions' }, [
          // User info and logout
          currentUser ? h('sl-dropdown', {}, [
            h('sl-button', { slot: 'trigger', caret: true, size: 'small' }, [
              currentUser.name || currentUser.email,
            ]),
            h('sl-menu', {}, [
              h('sl-menu-item', {
                onclick: handleLogout,
              }, [t('nav.signOut')]),
            ]),
          ]) : null,
          createThemeToggle(),
        ].filter(Boolean)),
      ]),

      // Main content
      h('main', { id: 'main', class: 'vk-main' }, [content]),
    ]);

    app.appendChild(shell);
  }

  /**
   * Handle logout
   */
  async function handleLogout() {
    try {
      await logout();
      currentUser = null;
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }

  /**
   * Render a not found page
   */
  function render404() {
    const content = h('div', { class: 'text-center py-4' }, [
      h('h1', { class: 'text-2xl mb-4' }, [t('notFound.title')]),
      h('p', { class: 'text-secondary mb-6' }, [t('notFound.message')]),
      h('sl-button', {
        variant: 'primary',
        onclick: () => navigate('/'),
      }, [t('notFound.goHome')]),
    ]);

    renderShell(content);
  }

  /**
   * Check auth and redirect to login if needed
   */
  async function requireAuth() {
    try {
      currentUser = await getMeCached();
      if (!currentUser) {
        const returnTo = `${location.pathname}${location.search || ''}`;
        navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return false;
      }
      return true;
    } catch {
      navigate('/login');
      return false;
    }
  }

  // Define routes

  // Login page (no auth required)
  route('/login', async () => {
    // If already logged in, redirect to home
    try {
      const user = await getMeCached();
      if (user) {
        navigate('/');
        return;
      }
    } catch {
      // ignore
    }
    empty(app);
    return renderLogin(app);
  });

  // Converter (home page)
  route('/', async () => {
    if (!(await requireAuth())) return;
    const content = h('div', {});
    renderShell(content, { activeNav: 'convert' });
    return renderConverter(content);
  });

  // Settings
  route('/settings', async () => {
    if (!(await requireAuth())) return;
    const content = h('div', {});
    renderShell(content, { activeNav: 'settings' });
    return renderSettings(content);
  });

  // 404 handler
  notFound(() => {
    render404();
  });

  // Start the router
  startRouter();
})();

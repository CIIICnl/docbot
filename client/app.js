/**
 * DreamDocs Application
 * Convert Notion pages and markdown to beautifully styled PDFs.
 */

import { route, notFound, startRouter, navigate } from './lib/router.js';
import { initTheme, createThemeToggle } from './lib/theme.js';
import { $, h, empty } from './lib/dom.js';
import { renderList } from './views/list.js';
import { renderEditor } from './views/editor/index.js';
import { showSettingsModal } from './views/settings.js';
import { renderLogin } from './views/login.js';
import { renderForgotPassword } from './views/forgot-password.js';
import { renderResetPassword } from './views/reset-password.js';
import { renderMagicLogin } from './views/magic-login.js';
import { getMeCached, logout, clearUserCache } from './lib/auth.js';
import { initI18n, t } from './lib/i18n.js';
import { get, post } from './lib/api.js';
import { enableSync, syncFromServer, isSyncEnabled } from './lib/drafts.js';

// Initialize app
(async function init() {
  // Initialize theme and i18n
  initTheme();
  await initI18n();

  // Check server configuration and enable sync if database is available
  try {
    const configRes = await get('/api/auth/config');
    if (configRes.ok && configRes.data?.databaseEnabled) {
      enableSync();
      console.log('[app] Database sync enabled');
    }
  } catch (err) {
    console.warn('[app] Failed to fetch config:', err);
  }

  // Get app container
  const app = $('#app');

  // Current user state
  let currentUser = null;

  // Track open overlays for cleanup
  const openOverlayClosers = new Set();

  /**
   * Open settings modal
   */
  function openSettings(e) {
    if (e) e.preventDefault();
    showSettingsModal(app, openOverlayClosers);
  }

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
            class: activeNav === 'documents' ? 'is-active' : '',
          }, [t('nav.documents')]),
          h('a', {
            href: '#',
            onclick: openSettings,
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

  // Forgot password page (no auth required)
  route('/forgot-password', async () => {
    empty(app);
    return renderForgotPassword(app);
  });

  // Reset password page (no auth required)
  route('/reset-password', async () => {
    empty(app);
    return renderResetPassword(app);
  });

  // Magic login page (no auth required)
  route('/magic-login', async () => {
    empty(app);
    return renderMagicLogin(app);
  });

  // Documents list (home page)
  route('/', async () => {
    if (!(await requireAuth())) return;

    const content = h('div', {});
    renderShell(content, { activeNav: 'documents' });

    // Pull the latest documents from the server BEFORE rendering the list.
    // renderList reads synchronously from the local (localStorage) store, so
    // on a fresh session that store is empty and an un-awaited background sync
    // rendered "geen documenten" until a manual re-navigation (e.g. clicking
    // the logo). The shell is already painted above, so awaiting here only
    // delays the list body, not the whole page.
    if (isSyncEnabled()) {
      try {
        await syncFromServer();
      } catch (err) {
        console.warn('[app] Failed to sync from server:', err);
      }
    }

    return renderList(content, { navigate, api: { get, post } });
  });

  // Editor
  route('/edit/:id', async ({ params }) => {
    if (!(await requireAuth())) return;
    const content = h('div', {});
    renderShell(content, { activeNav: 'documents' });
    return renderEditor(content, { draftId: params.id, navigate });
  });

  // Settings route - redirect to home and open modal
  route('/settings', async () => {
    if (!(await requireAuth())) return;
    navigate('/');
    // Small delay to let the home page render first
    setTimeout(() => openSettings(), 50);
  });

  // 404 handler
  notFound(() => {
    render404();
  });

  // Start the router
  startRouter();
})();

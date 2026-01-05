/**
 * Settings View
 * Application settings page.
 */

import { h, empty } from '../lib/dom.js';
import { pageHeader, settingsSection } from '../lib/components.js';
import { getTheme, setTheme } from '../lib/theme.js';
import { success } from '../lib/toast.js';
import { slSelect, slButton, slTextarea, sl } from '../lib/shoelace.js';
import { get } from '../lib/api.js';
import { STORAGE_KEYS, PLACEHOLDERS } from '../lib/constants.js';
import { t, getLocale, setLocale, getSupportedLocales } from '../lib/i18n.js';

/**
 * Render the settings view
 * @param {HTMLElement} container
 * @returns {Function} Cleanup function
 */
export async function renderSettings(container) {
  render(container);

  return () => {
    // Cleanup
  };
}

/**
 * Render the settings UI
 */
async function render(container) {
  empty(container);

  // Check LLM availability
  let llmProviders = { claude: false, mistral: false };
  try {
    const result = await get('/api/llm/status');
    if (result.ok) {
      llmProviders = result.data.providers;
    }
  } catch {
    // LLM not available
  }

  // Theme toggle
  const themeSelect = slSelect({
    value: getTheme(),
    hoist: true,
  });

  themeSelect.appendChild(sl('sl-option', { value: 'light' }, [t('settings.appearance.themeLight')]));
  themeSelect.appendChild(sl('sl-option', { value: 'dark' }, [t('settings.appearance.themeDark')]));

  themeSelect.addEventListener('sl-change', (e) => {
    setTheme(e.target.value);
    success(t('toast.themeChanged', { theme: e.target.value }));
  });

  // Language selector
  const languageSelect = slSelect({
    value: getLocale(),
    hoist: true,
  });

  for (const locale of getSupportedLocales()) {
    languageSelect.appendChild(sl('sl-option', { value: locale.code }, [locale.name]));
  }

  languageSelect.addEventListener('sl-change', async (e) => {
    await setLocale(e.target.value);
    success(t('toast.languageChanged'));
    // Re-render the page to update all translations
    render(container);
  });

  // Appearance section
  const appearanceSection = settingsSection({
    title: t('settings.appearance.title'),
    description: t('settings.appearance.description'),
    rows: [
      {
        label: t('settings.appearance.themeLabel'),
        description: t('settings.appearance.themeDescription'),
        control: themeSelect,
      },
      {
        label: t('settings.appearance.languageLabel'),
        description: t('settings.appearance.languageDescription'),
        control: languageSelect,
      },
    ],
  });

  // AI Enhancement section
  const globalContext = slTextarea({
    value: localStorage.getItem(STORAGE_KEYS.GLOBAL_CONTEXT) || '',
    placeholder: t('placeholders.globalContext'),
    rows: 6,
    resize: 'vertical',
    style: 'width: 100%;',
  });

  globalContext.addEventListener('sl-input', (e) => {
    localStorage.setItem(STORAGE_KEYS.GLOBAL_CONTEXT, e.target.value);
  });

  globalContext.addEventListener('sl-blur', () => {
    success(t('toast.contextSaved'));
  });

  const defaultProvider = slSelect({
    value: localStorage.getItem(STORAGE_KEYS.DEFAULT_PROVIDER) || 'claude',
    hoist: true,
    style: 'width: 200px;',
  });

  const claudeOption = sl('sl-option', { value: 'claude' }, [t('settings.ai.providerClaude')]);
  const mistralOption = sl('sl-option', { value: 'mistral' }, [t('settings.ai.providerMistral')]);

  if (!llmProviders.claude) claudeOption.disabled = true;
  if (!llmProviders.mistral) mistralOption.disabled = true;

  defaultProvider.appendChild(claudeOption);
  defaultProvider.appendChild(mistralOption);

  defaultProvider.addEventListener('sl-change', (e) => {
    localStorage.setItem(STORAGE_KEYS.DEFAULT_PROVIDER, e.target.value);
    success(t('toast.providerChanged', { provider: e.target.value }));
  });

  const aiAvailable = llmProviders.claude || llmProviders.mistral;

  // Build AI section with full-width global context
  const aiSection = h('div', { class: 'vk-settings-section' }, [
    h('h2', { class: 'vk-settings-section-title' }, [t('settings.ai.title')]),
    h('p', { class: 'vk-settings-section-description' }, [
      aiAvailable
        ? t('settings.ai.descriptionAvailable')
        : t('settings.ai.descriptionUnavailable'),
    ]),
    ...(aiAvailable
      ? [
          // Default provider row (standard layout)
          h('div', { class: 'vk-settings-row' }, [
            h('div', { class: 'vk-settings-row-label' }, [
              h('h4', {}, [t('settings.ai.providerLabel')]),
              h('p', {}, [t('settings.ai.providerDescription')]),
            ]),
            h('div', { class: 'vk-settings-row-control' }, [defaultProvider]),
          ]),
          // Global context (full width)
          h('div', { class: 'vk-settings-row', style: 'flex-direction: column; align-items: stretch;' }, [
            h('div', { class: 'vk-settings-row-label', style: 'margin-bottom: var(--sl-spacing-small);' }, [
              h('h4', {}, [t('settings.ai.contextLabel')]),
              h('p', {}, [t('settings.ai.contextDescription')]),
            ]),
            globalContext,
          ]),
        ]
      : []),
  ]);

  // Danger zone
  const deleteButton = slButton({
    variant: 'danger',
    outline: true,
    text: t('settings.danger.deleteAllButton'),
  });

  const dangerSection = h('div', { class: 'vk-settings-section mt-8' }, [
    h('h2', { class: 'vk-settings-section-title text-danger' }, [t('settings.danger.title')]),
    h('p', { class: 'vk-settings-section-description' }, [
      t('settings.danger.description'),
    ]),
    h('div', { class: 'vk-card mt-4' }, [
      h('div', { class: 'vk-card-body flex items-center justify-between' }, [
        h('div', {}, [
          h('h4', { class: 'font-medium' }, [t('settings.danger.deleteAllTitle')]),
          h('p', { class: 'text-sm text-muted mt-1' }, [
            t('settings.danger.deleteAllDescription'),
          ]),
        ]),
        deleteButton,
      ]),
    ]),
  ]);

  // Page header
  const header = pageHeader({
    title: t('settings.title'),
    subtitle: t('settings.subtitle'),
  });

  container.appendChild(header);

  const settingsContainer = h('div', { class: 'vk-settings' }, [
    appearanceSection,
    aiSection,
    dangerSection,
  ]);

  container.appendChild(settingsContainer);
}

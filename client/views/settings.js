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

  themeSelect.appendChild(sl('sl-option', { value: 'light' }, ['Light']));
  themeSelect.appendChild(sl('sl-option', { value: 'dark' }, ['Dark']));

  themeSelect.addEventListener('sl-change', (e) => {
    setTheme(e.target.value);
    success(`Theme changed to ${e.target.value}`);
  });


  // Appearance section
  const appearanceSection = settingsSection({
    title: 'Appearance',
    description: 'Customize how the application looks.',
    rows: [
      {
        label: 'Theme',
        description: 'Choose between light and dark mode.',
        control: themeSelect,
      },
    ],
  });

  // AI Enhancement section
  const globalContext = slTextarea({
    value: localStorage.getItem(STORAGE_KEYS.GLOBAL_CONTEXT) || '',
    placeholder: PLACEHOLDERS.GLOBAL_CONTEXT,
    rows: 6,
    resize: 'vertical',
    style: 'width: 100%;',
  });

  globalContext.addEventListener('sl-input', (e) => {
    localStorage.setItem(STORAGE_KEYS.GLOBAL_CONTEXT, e.target.value);
  });

  globalContext.addEventListener('sl-blur', () => {
    success('AI context saved');
  });

  const defaultProvider = slSelect({
    value: localStorage.getItem(STORAGE_KEYS.DEFAULT_PROVIDER) || 'claude',
    hoist: true,
    style: 'width: 200px;',
  });

  const claudeOption = sl('sl-option', { value: 'claude' }, ['Claude (Recommended)']);
  const mistralOption = sl('sl-option', { value: 'mistral' }, ['Mistral (EU)']);

  if (!llmProviders.claude) claudeOption.disabled = true;
  if (!llmProviders.mistral) mistralOption.disabled = true;

  defaultProvider.appendChild(claudeOption);
  defaultProvider.appendChild(mistralOption);

  defaultProvider.addEventListener('sl-change', (e) => {
    localStorage.setItem(STORAGE_KEYS.DEFAULT_PROVIDER, e.target.value);
    success(`Default provider set to ${e.target.value}`);
  });

  const aiAvailable = llmProviders.claude || llmProviders.mistral;

  // Build AI section with full-width global context
  const aiSection = h('div', { class: 'vk-settings-section' }, [
    h('h2', { class: 'vk-settings-section-title' }, ['AI Enhancement']),
    h('p', { class: 'vk-settings-section-description' }, [
      aiAvailable
        ? 'Configure AI-powered document enhancement for Word imports.'
        : 'AI enhancement requires API keys. Add ANTHROPIC_API_KEY or MISTRAL_API_KEY to your .env file.',
    ]),
    ...(aiAvailable
      ? [
          // Default provider row (standard layout)
          h('div', { class: 'vk-settings-row' }, [
            h('div', { class: 'vk-settings-row-label' }, [
              h('h4', {}, ['Default Provider']),
              h('p', {}, ['Choose which AI provider to use by default.']),
            ]),
            h('div', { class: 'vk-settings-row-control' }, [defaultProvider]),
          ]),
          // Global context (full width)
          h('div', { class: 'vk-settings-row', style: 'flex-direction: column; align-items: stretch;' }, [
            h('div', { class: 'vk-settings-row-label', style: 'margin-bottom: var(--sl-spacing-small);' }, [
              h('h4', {}, ['Global Context']),
              h('p', {}, ['Instructions that apply to all document conversions.']),
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
    text: 'Delete All',
  });

  const dangerSection = h('div', { class: 'vk-settings-section mt-8' }, [
    h('h2', { class: 'vk-settings-section-title text-danger' }, ['Danger Zone']),
    h('p', { class: 'vk-settings-section-description' }, [
      'Irreversible actions that affect your account.',
    ]),
    h('div', { class: 'vk-card mt-4' }, [
      h('div', { class: 'vk-card-body flex items-center justify-between' }, [
        h('div', {}, [
          h('h4', { class: 'font-medium' }, ['Delete All Items']),
          h('p', { class: 'text-sm text-muted mt-1' }, [
            'Permanently delete all items. This cannot be undone.',
          ]),
        ]),
        deleteButton,
      ]),
    ]),
  ]);

  // Page header
  const header = pageHeader({
    title: 'Settings',
    subtitle: 'Manage your preferences',
  });

  container.appendChild(header);

  const settingsContainer = h('div', { class: 'vk-settings' }, [
    appearanceSection,
    aiSection,
    dangerSection,
  ]);

  container.appendChild(settingsContainer);
}

/**
 * Settings View
 * Application settings page.
 */

import { h, empty } from '../lib/dom.js';
import { pageHeader, settingsSection } from '../lib/components.js';
import { getTheme, setTheme } from '../lib/theme.js';
import { success, error } from '../lib/toast.js';
import { slSelect, slSwitch, slInput, slButton, slTextarea, sl } from '../lib/shoelace.js';
import { get } from '../lib/api.js';

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

  // Notification toggle
  const notifySwitch = slSwitch({ checked: true });
  notifySwitch.addEventListener('sl-change', (e) => {
    success(e.target.checked ? 'Notifications enabled' : 'Notifications disabled');
  });

  // Email input
  const emailInput = slInput({
    type: 'email',
    placeholder: 'your@email.com',
    style: { width: '250px' },
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
    value: localStorage.getItem('dreamdocs_global_context') || '',
    placeholder: 'Enter organization style preferences and general instructions for AI enhancement...\n\nExamples:\n- Use sentence case for headings\n- Keep paragraphs concise\n- Use bullet points for lists of 3+ items',
    rows: 6,
    resize: 'vertical',
    style: 'width: 100%; max-width: 500px;',
  });

  globalContext.addEventListener('sl-input', (e) => {
    localStorage.setItem('dreamdocs_global_context', e.target.value);
  });

  globalContext.addEventListener('sl-blur', () => {
    success('AI context saved');
  });

  const defaultProvider = slSelect({
    value: localStorage.getItem('dreamdocs_default_provider') || 'claude',
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
    localStorage.setItem('dreamdocs_default_provider', e.target.value);
    success(`Default provider set to ${e.target.value}`);
  });

  const aiAvailable = llmProviders.claude || llmProviders.mistral;

  const aiSection = settingsSection({
    title: 'AI Enhancement',
    description: aiAvailable
      ? 'Configure AI-powered document enhancement for Word imports.'
      : 'AI enhancement requires API keys. Add ANTHROPIC_API_KEY or MISTRAL_API_KEY to your .env file.',
    rows: aiAvailable
      ? [
          {
            label: 'Default Provider',
            description: 'Choose which AI provider to use by default.',
            control: defaultProvider,
          },
          {
            label: 'Global Context',
            description: 'Instructions that apply to all document conversions.',
            control: globalContext,
          },
        ]
      : [],
  });

  // Notifications section
  const notificationsSection = settingsSection({
    title: 'Notifications',
    description: 'Configure how you receive notifications.',
    rows: [
      {
        label: 'Push Notifications',
        description: 'Receive push notifications for important updates.',
        control: notifySwitch,
      },
      {
        label: 'Email Address',
        description: 'Email address for notification delivery.',
        control: emailInput,
      },
    ],
  });

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
    notificationsSection,
    dangerSection,
  ]);

  container.appendChild(settingsContainer);
}

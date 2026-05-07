/**
 * LLM Provider
 * Unified interface for calling Claude and Mistral APIs.
 */

import Anthropic from '@anthropic-ai/sdk';
import { LLM_MODELS, LLM_ENDPOINTS } from '../../config/constants.js';
import type { LlmProvider, ProviderRequest } from './types.js';

/**
 * Check which LLM providers are available
 */
export function getAvailableProviders(): Record<LlmProvider, boolean> {
  return {
    none: true, // Always available - no AI
    openai: !!process.env.OPENAI_API_KEY,
    claude: !!process.env.ANTHROPIC_API_KEY,
    mistral: !!process.env.MISTRAL_API_KEY,
  };
}

/**
 * Check if a specific provider is available
 */
export function isProviderAvailable(provider: LlmProvider): boolean {
  return getAvailableProviders()[provider] ?? false;
}

/**
 * Validate that a provider is available
 * Returns error message if not available, null if available
 */
export function validateProvider(provider: LlmProvider): string | null {
  if (!isProviderAvailable(provider)) {
    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    return `${providerName} API key is not configured`;
  }
  return null;
}

/**
 * Get API key for a provider
 */
function getApiKey(provider: LlmProvider): string {
  if (provider === 'none') {
    throw new Error('No API key needed for disabled AI');
  }

  const keys: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    claude: process.env.ANTHROPIC_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
  };

  const key = keys[provider];
  if (!key) {
    throw new Error(`${provider.toUpperCase()} API key is not configured`);
  }
  return key;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(request: ProviderRequest): Promise<string> {
  const apiKey = getApiKey('openai');

  const response = await fetch(LLM_ENDPOINTS.OPENAI, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LLM_MODELS.OPENAI,
      messages: [
        {
          role: 'system',
          content: request.systemPrompt,
        },
        {
          role: 'user',
          content: request.userContent,
        },
      ],
      max_completion_tokens: request.maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return content;
}

/**
 * Call Claude API
 */
async function callClaude(request: ProviderRequest): Promise<string> {
  const apiKey = getApiKey('claude');
  const client = new Anthropic({ apiKey });

  // Stream to avoid the SDK's 10-minute non-streaming guard, which trips
  // on large max_tokens values for slower models like Opus.
  const message = await client.messages
    .stream({
      model: LLM_MODELS.CLAUDE,
      max_tokens: request.maxTokens,
      messages: [
        {
          role: 'user',
          content: request.userContent,
        },
      ],
      system: request.systemPrompt,
    })
    .finalMessage();

  if (message.stop_reason && message.stop_reason !== 'end_turn') {
    console.warn(
      `[claude] non-terminal stop_reason="${message.stop_reason}" ` +
        `(model=${LLM_MODELS.CLAUDE}, max_tokens=${request.maxTokens}, ` +
        `output_tokens=${message.usage?.output_tokens}). ` +
        `If "max_tokens", JSON output was likely truncated and parse will fail.`
    );
  }

  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return textContent.text;
}

/**
 * Call Mistral API
 */
async function callMistral(request: ProviderRequest): Promise<string> {
  const apiKey = getApiKey('mistral');

  const response = await fetch(LLM_ENDPOINTS.MISTRAL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LLM_MODELS.MISTRAL,
      messages: [
        {
          role: 'system',
          content: request.systemPrompt,
        },
        {
          role: 'user',
          content: request.userContent,
        },
      ],
      max_tokens: request.maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Mistral API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from Mistral');
  }

  return content;
}

/**
 * Call an LLM provider with the given request
 */
export async function callProvider(request: ProviderRequest): Promise<string> {
  switch (request.provider) {
    case 'none':
      throw new Error('AI enhancement is disabled');
    case 'openai':
      return callOpenAI(request);
    case 'claude':
      return callClaude(request);
    case 'mistral':
      return callMistral(request);
    default:
      throw new Error(`Unknown LLM provider: ${request.provider}`);
  }
}

/**
 * Translation Prompts
 * System prompts for AI translation.
 */

import { generateTerminologyPrompt, getGuidelines } from 'ciiic-translation-rules';

export type TranslationDirection = 'nl-to-en' | 'en-to-nl';

/**
 * Build the system prompt for translation
 */
export function buildTranslationSystemPrompt(direction: TranslationDirection): string {
  const [sourceLang, targetLang, targetCode] = direction === 'nl-to-en'
    ? ['Dutch', 'English', 'en'] as const
    : ['English', 'Dutch', 'nl'] as const;

  return `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}.

Rules:
- Preserve ALL markdown formatting exactly (headings, lists, links, bold, italic, code blocks, etc.)
- Preserve image references ![...](...) exactly as-is
- Preserve code blocks and inline code exactly as-is (do not translate code)
- Maintain the same paragraph structure
- Translate naturally, not word-for-word
- Keep proper nouns and brand names unchanged unless they have standard translations
- Output ONLY the translated text, no explanations or comments

--- TERMINOLOGY RULES ---
${generateTerminologyPrompt()}

${getGuidelines(targetCode)}`;
}

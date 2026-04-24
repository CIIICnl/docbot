/**
 * Enhancement Prompts
 * System prompts for AI document enhancement.
 */

export interface EnhancePromptOptions {
  fixStructure?: boolean;
  fixTypos?: boolean;
  improveReadability?: boolean;
  getSuggestions?: boolean;
  globalContext?: string;
  language?: 'en' | 'nl';
}

const STRUCTURE_PROMPT = `## Document Structure Improvements
Fix formatting and structure issues:
- Bold text that should be headings (e.g., a bold line that acts as a section title should be converted to ## or ###)
- Inconsistent heading levels (ensure proper hierarchy: H1 > H2 > H3)
- Manual numbering that should be ordered lists (e.g., "1. item" typed manually instead of using list syntax)
- Improper list formatting (tabs or spaces used instead of proper markdown list syntax)
- Missing blank lines between sections
- Tables formatted with spaces/tabs instead of proper markdown table syntax
- Excessive whitespace or line breaks

`;

const TYPOS_PROMPT = `## Typo Corrections
Fix small text errors:
- Double spaces (replace with single space)
- Obvious spelling errors (only if you are confident it's an error, not a proper noun or technical term)
- Missing spaces after punctuation
- Repeated words (e.g., "the the")
Do NOT change words if you're unsure - only fix clear typos.

`;

const READABILITY_PROMPT = `## Readability Improvements
Improve the flow and clarity of the text WITHOUT changing the meaning:
- Reorder words within sentences for better flow
- Use clearer synonyms when they improve readability (but keep the author's voice)
- Break up overly long sentences into shorter ones
- Improve paragraph transitions
- Fix awkward phrasing

IMPORTANT: The goal is to make the existing content clearer, NOT to rewrite it. The author's ideas and voice should remain intact. Only make changes that genuinely improve readability - if a sentence is already clear, leave it alone.

`;

const PRESERVATION_RULES = `## Preservation Rules
Always preserve:
- All content and meaning
- Links and their destinations
- Image references (![...](...)) - especially any with __IMAGE_PLACEHOLDER_N__ URLs, keep these exactly as-is
- Code blocks
- Intentional bold/italic formatting that isn't being converted to headings

`;

const SUGGESTIONS_INTRO = `First, provide an overall impression of the document - a brief assessment (2-4 sentences) covering:
- The document's strengths and what it does well
- The overall quality of writing and organization
- The main areas that could use improvement

Then provide thoughtful suggestions and questions about:
- Content that might be missing or unclear
- Sections that could be reorganized for better flow
- Points that need more explanation or examples
- Potential factual inconsistencies
- Tone or audience considerations
- Any questions a reader might have

Do NOT make these changes yourself - just note them as suggestions. The author will decide whether to act on them.

`;

const OUTPUT_FORMAT = (willModify: boolean, language?: 'en' | 'nl') => {
  const languageInstruction = language === 'nl'
    ? `

IMPORTANT: Write all change descriptions and suggestions in Dutch (Nederlands). The "description" and "text" fields must be in Dutch so the user can understand them in their preferred language.`
    : '';

  return `## Output Format
Return a JSON object with these fields:
1. "markdown": ${willModify ? 'The improved markdown content' : 'The original markdown content unchanged'}
2. "changes": A SUMMARIZED array of changes for quick overview display. Group similar changes together for readability. Each entry should have:
   - "description": A user-friendly summary of what was changed (e.g., "Fixed several typos including 'teh' → 'the', 'recieve' → 'receive'", "Converted bold headings to proper section headings")
   - "location": General location (e.g., "Throughout the document", "In the Introduction and Methods sections")
   - "category": One of: "structure", "typo", "readability", or "other"
3. "detailedChanges": (OPTIONAL - include if possible) A COMPLETE array listing EVERY SINGLE individual change separately. This is used for generating editing instructions. If you fix 10 typos, create 10 separate entries. Each entry should have:
   - "description": A specific editing instruction for ONE change (e.g., "Change 'teh' to 'the'", "Change the bold text 'Introduction' to a heading level 2")
   - "location": Precise location so an editor can find it (e.g., "In the 'Overview' section, first paragraph, third sentence", "Under the 'Pricing' heading, in the bullet list")
   - "category": One of: "structure", "typo", "readability", or "other"
4. "suggestions": An array of feedback items (empty if feedback was not requested), each with:
   - "text": The suggestion or question in a helpful, constructive tone, phrased as an actionable recommendation
   - "location": Be specific about where in the document this applies
5. "overallImpression": A brief overall assessment of the document (2-4 sentences). Only include this field if feedback/suggestions were requested.
6. "coverPage": An object with metadata for the document cover page. ALWAYS include all three fields:
   - "subtitle": A subtitle or tagline. If explicitly mentioned in the document, use that. Otherwise, generate a brief descriptive subtitle (5-10 words).
   - "version": A version number. If mentioned in the document, use that. Otherwise, use "v1.0" as the default.
   - "date": A document date. If mentioned in the document, use that. Otherwise, use today's date in a readable format like "January 2025".

Priority: Always include "markdown", "changes", "suggestions", "coverPage". Include "detailedChanges" if there's sufficient output capacity - it will be fetched separately if not included.${languageInstruction}`;
};

/**
 * Build the system prompt for markdown enhancement
 */
export function buildEnhanceSystemPrompt(options: EnhancePromptOptions): string {
  const { fixStructure, fixTypos, improveReadability, getSuggestions, globalContext, language } = options;

  let prompt = `You are a document expert helping improve a markdown document. `;

  // Determine what modifications to make
  const willModify = fixStructure || fixTypos || improveReadability;

  if (willModify) {
    prompt += `Your task is to improve the document based on the selected options.\n\n`;

    if (fixStructure) {
      prompt += STRUCTURE_PROMPT;
    }

    if (fixTypos) {
      prompt += TYPOS_PROMPT;
    }

    if (improveReadability) {
      prompt += READABILITY_PROMPT;
    }

    prompt += PRESERVATION_RULES;
  }

  // Suggestions mode
  if (getSuggestions) {
    if (willModify) {
      prompt += `## Feedback Mode
In addition to making the above changes, also provide suggestions for improvements that require human judgment.
`;
    } else {
      prompt += `Your task is to provide feedback and suggestions WITHOUT modifying the document.

## Feedback Mode
`;
    }

    prompt += SUGGESTIONS_INTRO;
  }

  // Output format
  prompt += OUTPUT_FORMAT(!!willModify, language);

  if (globalContext) {
    prompt += `\n\n## Additional Context\nOrganization's style preferences:\n${globalContext}`;
  }

  return prompt;
}

/**
 * Build the user prompt for a specific document
 */
export function buildEnhanceUserPrompt(markdown: string, documentContext?: string): string {
  let prompt = '';

  if (documentContext) {
    prompt += `Document-specific instructions:\n${documentContext}\n\n`;
  }

  prompt += `Please improve the formatting of this markdown document:\n\n${markdown}`;

  return prompt;
}

/**
 * Build prompts for extracting detailed changes from summarized changes
 * Used when detailed changes weren't included in the initial response
 */
export function buildDetailedChangesPrompt(
  markdown: string,
  changesSummary: Array<{ description: string; location?: string; category?: string }>,
  language?: 'en' | 'nl'
): { systemPrompt: string; userPrompt: string } {
  const languageInstruction = language === 'nl'
    ? `\n\nIMPORTANT: Write all descriptions in Dutch (Nederlands).`
    : '';

  const systemPrompt = `You are a document editor assistant. Your task is to expand summarized changes into individual, actionable editing instructions.

You will be given:
1. A document
2. A summary of changes that were made to it

Your job is to identify EVERY SINGLE individual change and list them separately with precise locations.

## Output Format
Return a JSON object with one field:
"detailedChanges": An array where EACH individual change is a separate entry. For example, if the summary says "Fixed 5 typos", you must list all 5 typos as separate entries.

Each entry should have:
- "description": A specific editing instruction for ONE change (e.g., "Change 'teh' to 'the'", "Change the bold text 'Introduction' to a heading level 2")
- "location": Precise location so an editor can find it (e.g., "In the 'Overview' section, first paragraph, third sentence", "Under the 'Pricing' heading, in the bullet list")
- "category": One of: "structure", "typo", "readability", or "other"

Be thorough - list EVERY change, no matter how small. These instructions will be given to someone manually editing the original document.${languageInstruction}`;

  const summaryText = changesSummary
    .map((c, i) => `${i + 1}. ${c.description}${c.location ? ` (${c.location})` : ''}`)
    .join('\n');

  const userPrompt = `## Document
${markdown}

## Summary of Changes Made
${summaryText}

Please expand these summarized changes into individual, specific editing instructions.`;

  return { systemPrompt, userPrompt };
}

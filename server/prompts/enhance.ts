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

const SUGGESTIONS_INTRO = `Provide thoughtful suggestions and questions about:
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
2. "changes": An array of objects describing each change made (empty if no modifications were requested), each with:
   - "description": A user-friendly explanation of what was changed and why. The user may not know markdown, so describe changes in plain terms. For example:
     - Instead of "Converted **text** to ## heading", write "Changed 'Introduction' from bold text to a proper section heading (H2)"
     - Include the actual text/heading name when relevant so users can identify where the change was made
   - "location": Where in the document this change was made (e.g., "Introduction section", "near the beginning")
   - "category": One of: "structure" (heading conversions, list formatting, hierarchy fixes), "typo" (spelling, double spaces, punctuation), "readability" (sentence rewording, clarity improvements), or "other"
3. "suggestions": An array of feedback items (empty if feedback was not requested), each with:
   - "text": The suggestion or question in a helpful, constructive tone
   - "location": Where in the document this applies (e.g., "Methods section", "paragraph about pricing")
4. "coverPage": An object with metadata for the document cover page. ALWAYS include all three fields:
   - "subtitle": A subtitle or tagline. If explicitly mentioned in the document, use that. Otherwise, generate a brief descriptive subtitle (5-10 words) that captures the document's purpose or main topic. Always provide something.
   - "version": A version number. If mentioned in the document (e.g., "v1.0", "Version 2.3", "Draft 1"), use that. Otherwise, use "v1.0" as the default.
   - "date": A document date. If mentioned in the document (e.g., "January 2025", "2025-01-07", "Updated: March 2024"), use that. Otherwise, use today's date in a readable format like "January 2025".

Only include substantive changes in the changes array, not minor whitespace adjustments.${languageInstruction}`;
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

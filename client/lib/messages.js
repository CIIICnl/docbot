/**
 * UI Messages
 * Loading messages for AI enhancement stages and other user-facing text.
 */

// Loading messages for AI enhancement stages
export const ENHANCE_MESSAGES = {
  analyzing: [
    'Analyzing your document...',
    'Dissecting your doc for detailed analysis...',
    'Reading between the lines...',
  ],
  improving: [
    'Making improvements...',
    'Polishing your prose...',
    'Working some magic...',
    'Refining the details...',
    'Smoothing out the rough edges...',
    'Fine-tuning your content...',
    'Sprucing things up...',
    'Giving it a fresh coat of paint...',
    'Tightening up the language...',
    'Adding some polish...',
    'Perfecting the structure...',
    'Cleaning up the formatting...',
    'Making it shine...',
  ],
  wrapping: [
    'Finalizing changes...',
    'Almost done...',
    'Wrapping things up...',
  ],
};

// Loading messages for suggestion-only mode
export const SUGGESTION_MESSAGES = {
  analyzing: [
    'Reading through your document...',
    'Examining the content...',
    'Taking a close look...',
  ],
  thinking: [
    'Thinking about improvements...',
    'Pondering your prose...',
    'Formulating feedback...',
    'Considering your content...',
    'Weighing the options...',
    'Mulling over the details...',
    'Crafting suggestions...',
    'Reviewing the structure...',
    'Analyzing the flow...',
    'Looking for opportunities...',
    'Gathering insights...',
    'Evaluating the language...',
    'Spotting potential improvements...',
  ],
  wrapping: [
    'Preparing suggestions...',
    'Almost ready...',
    'Gathering thoughts...',
  ],
};

/**
 * Pick a random message from an array
 * @param {string[]} arr - Array of messages
 * @returns {string} Random message
 */
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

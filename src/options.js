/**
 * @typedef {object} Options
 * @property {boolean} enableDnd Whether the drag'n'drop of words should be enabled.
 * @property {boolean} enableKeyboardShortcuts Whether the keyboard shortcuts should be enabled.
 * @property {boolean} disableWordButtonsTts Whether sounds should not be played when a word is added to an answer.
 * @property {string} disableWordAnimation Whether and when the original word animation should be disabled.
 */

/**
 * @type {string}
 */
export const OPTION_TIMING_ALWAYS = 'always';

/**
 * @type {string}
 */
export const OPTION_TIMING_NEVER = 'never';

/**
 * @type {string}
 */
export const OPTION_TIMING_ON_DND = 'dnd';

/**
 * @type {Options}
 */
export const DEFAULT_OPTIONS = {
  enableDnd: true,
  enableKeyboardShortcuts: true,
  disableWordButtonsTts: false,
  disableWordAnimation: OPTION_TIMING_NEVER,
};

/**
 * @param {...Options} optionSets One or more sets of options.
 * @returns {Options} The combination of the given sets of options.
 */
export function mergeOptions(...optionSets) {
  const result = Object.assign({}, ...optionSets);

  for (const key of Object.keys(result)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_OPTIONS, key)) {
      delete result[key];
    }
  }

  return result;
}

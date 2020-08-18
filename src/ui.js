import { _, it, lift } from 'param.macro';
import { Draggable, Sortable } from '@shopify/draggable';

/**
 * The last seen prototype for the "Howl" type from the "howler.js" library.
 *
 * @type {object|null}
 */
let lastHowlPrototype = null;

/**
 * The last seen word-bank answer.
 *
 * @type {Element|null}
 */
let lastWordBankAnswer = null;

/**
 * Whether we are currently reinserting words in the current answer.
 *
 * @type {boolean}
 */
let isReinsertingWords = false;

/**
 * @param {string} selectors The CSS selectors to match against the element ancestors.
 * @param {number} maxLevel The maximum number of levels to go up in the tree.
 * @param {Element} element The base element.
 * @returns {boolean} Whether any ancestor of the given element matches the given selectors.
 */
function hasAncestorMatchingSelectors(selectors, maxLevel, element) {
  let level = 0;
  let parent = element;

  while ((parent = parent.parentElement) && (level++ < maxLevel)) {
    if (parent.matches(selectors)) {
      return true;
    }
  }

  return false;
}

// Poll for new word-bank answers and adapt them as necessary.
setInterval(() => {
  const newWordBankAnswer = document.querySelector(ANSWER_SELECTOR);

  if (newWordBankAnswer !== lastWordBankAnswer) {
    lastWordBankAnswer = newWordBankAnswer;

    if (!lastWordBankAnswer) {
      return;
    }

    const sortable = new Sortable(lastWordBankAnswer, {
      draggable: DRAGGABLE_WORD_SELECTOR,
      distance: 5,
    });

    sortable.removePlugin(Draggable.Plugins.Mirror);

    sortable.on('sortable:stop', event => {
      const wordBankSource = document.querySelector(SOURCE_SELECTOR);

      if (!wordBankSource) {
        return;
      }

      const answerWordButtons = Array.from(lastWordBankAnswer.querySelectorAll(WORD_BUTTON_SELECTOR));

      const sortedWords = answerWordButtons.map(button => {
        // Trigger the word removal.
        button.click();

        return hasAncestorMatchingSelectors('.draggable--original', 3, button)
          ? ''
          : button.innerText.trim();
      }).filter(it.length > 0);

      // Sometimes, the "draggable" plugin does not clean everything up.
      while (lastWordBankAnswer.firstChild) {
        lastWordBankAnswer.removeChild(lastWordBankAnswer.firstChild);
      }

      // The "draggable" plugin will attempt to move an element we have removed - make sure that it won't fail.
      const fakeSourceWrapper = document.createElement('div');
      fakeSourceWrapper.appendChild(event.dragEvent.source);

      const sourceButtons = Array.from(wordBankSource.querySelectorAll(WORD_BUTTON_SELECTOR));

      // TTS sounds will be played when words are reinserted - prevent this.
      isReinsertingWords = true;

      try {
        // Add the words back, in the right order.
        sourceButtons
          .map(button => {
            const index = sortedWords.indexOf(button.innerText.trim());

            if (index >= 0) {
              // Do not reuse a same word button twice.
              sortedWords[index] = null;
            }

            return [ index, button ];
          })
          .filter(it[0] >= 0)
          .sort(lift(_[0] - _[0]))
          .forEach(it[1].click());
      } catch (error) {
        isReinsertingWords = false;
        throw error;
      }

      isReinsertingWords = false;
    });
  }

  if (window.Howl && (lastHowlPrototype !== window.Howl.prototype)) {
    lastHowlPrototype = window.Howl.prototype;
    const originalHowlPlay = window.Howl.prototype.play;

    window.Howl.prototype.play = function (id) {
      if (!isReinsertingWords) {
        return originalHowlPlay.call(this, id);
      }
    };
  }
}, 50);

/**
 * A CSS selector for word-bank answers.
 *
 * @type {string}
 */
const ANSWER_SELECTOR = '.PcKtj';

/**
 * A CSS selector for sources of words.
 *
 * @type {string}
 */
const SOURCE_SELECTOR = '[data-test="word-bank"]';

/**
 * The possible CSS selectors for word tokens.
 *
 * @type {string[]}
 */
const WORD_SELECTORS = [ '._1yW4j', '._2LmyT', '._1DaLk' ];

/**
 * A CSS selector for word buttons anywhere on the page.
 *
 * @type {string}
 */
const WORD_BUTTON_SELECTOR = WORD_SELECTORS.map(`${it} button`).join(',');

/**
 * A CSS selector for word buttons in word-bank answers.
 *
 * @type {string}
 */
const DRAGGABLE_WORD_SELECTOR = WORD_SELECTORS.map(`${ANSWER_SELECTOR} ${it}`).join(',');

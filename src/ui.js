import { _, it, lift } from 'param.macro';
import { Draggable, Sortable } from '@shopify/draggable';

/**
 * The last seen prototype for the "Howl" type from the "howler.js" library.
 *
 * @type {object|null}
 */
let lastHowlPrototype = null;

/**
 * Whether the "howler.js" library is used to play sounds.
 *
 * @type {boolean}
 */
let isHowlerUsed = false;

/**
 * The last seen word-bank answer.
 *
 * @type {Element|null}
 */
let lastWordBankAnswer = null;

/**
 * The last seen overlay wrapper.
 *
 * @type {Element|null}
 */
let lastOverlayWrapper = null;

/**
 * Whether words fly into place rather than appearing directly in the answers.
 *
 * @type {boolean|null}
 */
let isUsingFlyingWords = null;

/**
 * The words that were present in the current answer before the user started dragging a word.
 *
 * @type {string[]}
 */
let originalAnswerWords = [];

/**
 * Whether the user is currently dragging a word in the current answer.
 *
 * @type {boolean}
 */
let isDraggingWord = false;

/**
 * Whether we are currently reinserting words in the current answer.
 *
 * @type {boolean}
 */
let isReinsertingWords = false;

/**
 * @type {Function}
 * @param {Element} button A word button.
 * @returns {boolean} Whether the given button is the original button for the currently dragged word.
 */
const isDraggedWordButton = it.classList.contains(DRAGGED_WORD_BUTTON_CLASS_NAME);

/**
 * @type {Function}
 * @returns {Element[]} The list of all word buttons in the current answer.
 */
const getAnswerWordButtons = () => (
  !lastWordBankAnswer
    ? []
    : Array.from(lastWordBankAnswer.querySelectorAll(WORD_BUTTON_SELECTOR))
);

/**
 * @type {Function}
 * @returns {string[]} The list of all relevant words in the current answer.
 */
const getAnswerWords = () => (
  getAnswerWordButtons()
    .map(button => isDraggedWordButton(button) ? '' : button.innerText.trim())
    .filter(it.length > 0)
);

/**
 * @type {Function}
 * @param {number} offset The number of words to skip.
 */
const applyFlyingWordsOrder = offset => {
  const wordBankSource = document.querySelector(SOURCE_SELECTOR);

  if (!wordBankSource) {
    return;
  }

  const sortedWords = [];
  const wordButtons = Array.from(lastWordBankAnswer.querySelectorAll(WORD_BUTTON_SELECTOR)).slice(offset);

  // Remove the necessary words one by one, to let everything animate smoothly.
  const removeAnswerWords = () => {
    const nextButton = wordButtons.shift();

    if (nextButton) {
      nextButton.click();

      if (!isDraggedWordButton(nextButton)) {
        const word = nextButton.innerText.trim();
        ('' !== word) && sortedWords.push(word);
      }

      setTimeout(() => {
        if (nextButton.isConnected) {
          // If the button has not been removed by now, it is a (unwanted) leftover from the "draggable" plugin.
          const leftoverElement = nextButton.closest(WORD_SELECTORS.join(',')) || nextButton;
          leftoverElement.parentNode.removeChild(leftoverElement);
        }

        removeAnswerWords();
      }, 1);

      return;
    }

    // TTS sounds will be played when words are reinserted - prevent this.
    isReinsertingWords = true;

    setTimeout(reinsertAnswerWords, 1);
  };

  let hasReinsertionStarted = false;

  // And do the same when reinserting words.
  const reinsertAnswerWords = () => {
    try {
      const sourceButtons = Array.from(wordBankSource.querySelectorAll(WORD_BUTTON_SELECTOR));

      // Wait for all the words to have flied back in place.
      if (
        hasReinsertionStarted
        || !lastOverlayWrapper
        || !lastOverlayWrapper.querySelector(OVERLAY_WORD_BUTTON_SELECTOR)
      ) {
        hasReinsertionStarted = true;
        const nextWord = sortedWords.shift();
        const nextButton = sourceButtons.find(!it.disabled && (nextWord === it.innerText.trim()));
        nextButton && nextButton.click();
      }

      if (sortedWords.length > 0) {
        setTimeout(reinsertAnswerWords, 1);
      } else {
        setTimeout(() => (isReinsertingWords = false), 1);
      }
    } catch (error) {
      isReinsertingWords = false;
      throw error;
    }
  };

  removeAnswerWords();
}

/**
 * @type {Function}
 * @param {Event} event The "drag" event.
 * @param {number} offset The number of words to skip.
 */
const applyNonFlyingWordsOrder = (event, offset) => {
  const wordBankSource = document.querySelector(SOURCE_SELECTOR);

  if (!wordBankSource) {
    return;
  }

  const sortedWords = Array.from(lastWordBankAnswer.querySelectorAll(WORD_BUTTON_SELECTOR))
    .slice(offset)
    .map(button => {
      button.click();
      return isDraggedWordButton(button) ? '' : button.innerText.trim();
    })
    .filter(it.length > 0);

  // Remove the additional button from the "draggable" plugin ourselves,
  // because it is not always automatically cleaned up.
  const dragSource = event.dragEvent.source;
  const fakeSourceWrapper = document.createElement('div');
  dragSource.parentNode.removeChild(dragSource);
  fakeSourceWrapper.appendChild(dragSource);

  // TTS sounds will be played when words are reinserted - prevent this.
  isReinsertingWords = true;

  // Add the words back, in the right order.
  try {
    Array.from(wordBankSource.querySelectorAll(WORD_BUTTON_SELECTOR))
      .filter(!it.disabled)
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
}

const overlayMutationObserver = new MutationObserver(() => {
  if (
    lastOverlayWrapper
    && (null !== lastOverlayWrapper.querySelector(OVERLAY_WORD_BUTTON_SELECTOR))
  ) {
    isUsingFlyingWords = true;
    overlayMutationObserver.disconnect();
  }
});


// Poll for new word-bank answers and prepare everything that is necessary.
setInterval(() => {
  const newOverlayWrapper = document.querySelector(OVERLAY_WRAPPER_SELECTOR);

  if (newOverlayWrapper !== lastOverlayWrapper) {
    lastOverlayWrapper = newOverlayWrapper;

    if (!lastOverlayWrapper) {
      return;
    }

    if (null === isUsingFlyingWords) {
      overlayMutationObserver.observe(lastOverlayWrapper, { childList: true });
    }
  }

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

    sortable.on('drag:start', event => {
      isDraggingWord = true;

      lastWordBankAnswer
        .querySelectorAll(`.${DRAGGED_WORD_BUTTON_CLASS_NAME}`)
        .forEach(it.classList.remove(DRAGGED_WORD_BUTTON_CLASS_NAME));

      const draggedButton = event.originalSource.querySelector(WORD_BUTTON_SELECTOR);

      if (null !== draggedButton) {
        draggedButton.classList.add(DRAGGED_WORD_BUTTON_CLASS_NAME);
      }

      originalAnswerWords = getAnswerWords();
    });

    sortable.on('sortable:stop', event => {
      isDraggingWord = false;

      if (null === isUsingFlyingWords) {
        isUsingFlyingWords = false;
        overlayMutationObserver.disconnect();
      }

      const updatedAnswerWords = getAnswerWords();

      // Only reorder as many words as necessary.
      let preservedWordCount = originalAnswerWords.findIndex(lift(_ !== updatedAnswerWords[_]));

      if (-1 === preservedWordCount) {
        if (updatedAnswerWords.length > originalAnswerWords.length) {
          preservedWordCount = originalAnswerWords.length;
        } else {
          return;
        }
      }

      if (isUsingFlyingWords) {
        applyFlyingWordsOrder(preservedWordCount);
      } else {
        applyNonFlyingWordsOrder(event, preservedWordCount);
      }
    });
  }

  if (window.Howl && (lastHowlPrototype !== window.Howl.prototype)) {
    lastHowlPrototype = window.Howl.prototype;
    const originalHowlPlay = window.Howl.prototype.play;

    window.Howl.prototype.play = function (id) {
      isHowlerUsed = true;

      if (!isReinsertingWords) {
        return originalHowlPlay.call(this, id);
      }
    };
  }
}, 50);

/**
 * @type {Function}
 */
const originalAudioPlay = Audio.prototype.play;

Audio.prototype.play = function () {
  if (isHowlerUsed || !isReinsertingWords) {
    return originalAudioPlay.call(this);
  }
};

document.addEventListener('keydown', event => {
  if (isDraggingWord && ('Backspace' === event.key)) {
    // Do not allow the user to remove words when dragging, because it can mess things up (adding words is fine though).
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true)

/**
 * A CSS selector for overlay wrappers.
 *
 * @type {string}
 */
const OVERLAY_WRAPPER_SELECTOR = '#overlays';

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
const WORD_SELECTORS = [ '._1yW4j', '.JSl9i', '._2LmyT' ];

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

/**
 * A CSS selector for flying word buttons in the overlay wrapper.
 *
 * @type {string}
 */
const OVERLAY_WORD_BUTTON_SELECTOR = 'button._1O290';

/**
 * The class name that is added to the original word button when a word is dragged.
 *
 * @type {string}
 */
const DRAGGED_WORD_BUTTON_CLASS_NAME = '_dnd_-dragged-word-button';

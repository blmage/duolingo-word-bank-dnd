import { _, it, lift } from 'one-liner.macro';
import { Draggable, Sortable } from '@shopify/draggable';
import { isArray, isObject, noop } from 'duo-toolbox/utils/functions';
import { discardEvent, isAnyInputFocused } from 'duo-toolbox/utils/ui';
import { CONTEXT_CHALLENGE, getCurrentContext } from 'duo-toolbox/duo/context';
import { onSoundPlaybackRequested, onUiLoaded } from 'duo-toolbox/duo/events';
import { SOUND_TYPE_TTS_WORD } from 'duo-toolbox/duo/sounds';
import { onBackgroundEvent, sendActionRequestToContentScript } from 'duo-toolbox/extension/ipc';
import { MUTEX_HOTKEYS, PRIORITY_LOWEST, requestMutex } from 'duo-toolbox/extension/ui';
import { ACTION_TYPE_GET_OPTIONS, BACKGROUND_EVENT_TYPE_OPTIONS_CHANGED } from './ipc';
import { DEFAULT_OPTIONS, OPTION_TIMING_ALWAYS, OPTION_TIMING_NEVER, OPTION_TIMING_ON_DND } from './options';

/**
 * @type {import('./options.js').Options}
 */
let options = DEFAULT_OPTIONS;

/**
 * Whether the "flying" animation of words should currently be disabled.
 * @type {boolean}
 */
let isWordAnimationDisabled = false;

/**
 * The last seen word-bank answer.
 * @type {Element|null}
 */
let lastWordBankAnswer = null;

/**
 * The last seen word-bank source.
 * @type {Element|null}
 */
let lastWordBankSource = null;

/**
 * The last seen wrapper of overlays.
 * @type {Element|null}
 */
let lastOverlayWrapper = null;

/**
 * Whether words fly into place rather than appearing directly in the answers.
 * @type {boolean|null}
 */
let isUsingFlyingWords = null;

/**
 * The words that were present in the current answer before the user started dragging a word.
 * @type {string[]}
 */
let originalAnswerWords = [];

/**
 * The callback usable to release the hotkeys mutex, once it has been acquired.
 * @type {Function|null}
 */
let hotkeysMutexReleaseCallback = null;

/**
 * Whether a (pending) request has been made to acquire the hotkeys mutex.
 * @type {boolean}
 */
let hasPendingHotkeysMutexRequest = false;

/**
 * Whether the user is currently dragging a word in the current answer.
 * @type {boolean}
 */
let isDraggingWord = false;

/**
 * Whether the user is currently moving a word in the current answer using the keyboard shortcuts.
 * @type {boolean}
 */
let isMovingWord = false;

/**
 * Whether we are currently rearranging words in the current answer.
 * @type {boolean}
 */
let isRearrangingWords = false;

/**
 * Whether we are currently reinserting words in the current answer.
 * @type {boolean}
 */
let isReinsertingWords = false;

/**
 * The last time a word action occurred (a word button was clicked, or a key was pressed).
 * @type {number|null}
 */
let lastWordActionAt = null;

/**
 * The index of the word button that is currently selected using the keyboard shortcuts.
 * @type {number|null}
 */
let selectedWordButtonIndex = null;

/**
 * The original index of the selected word button that is being moved using the keyboard shortcuts.
 * @type {number|null}
 */
let originalSelectedWordButtonIndex = null;

/**
 * @type {Function}
 * @param {Element} button A word button.
 * @returns {boolean} Whether the given button is the original button for the currently dragged word.
 */
const isDraggedWordButton = it.classList.contains(CLASS_NAME_DRAGGED_WORD_BUTTON);

/**
 * @returns {boolean} Whether any word from a work bank is currently "flying".
 */
const isAnyWordFlying = () => (
  isUsingFlyingWords
  && !!lastOverlayWrapper?.querySelector(SELECTOR_OVERLAY_WORD_BUTTON)
);

/**
 * @returns {Element[]} The list of all word buttons in the current answer.
 */
const getAnswerWordButtons = () => (
  !lastWordBankAnswer
    ? []
    : Array.from(lastWordBankAnswer.querySelectorAll(SELECTOR_WORD_BUTTON))
);

/**
 * @type {Function}
 * @param {Node} button A word button.
 * @returns {string} Whether the given button is disabled.
 */
const isWordButtonDisabled = it.disabled || ('true' === it.ariaDisabled);

/**
 * @type {Function}
 * @param {Node} button A word button.
 * @returns {string} The corresponding word.
 */
const getWordButtonWord = button => {
  let baseWord = button.querySelector(SELECTOR_WORD_BUTTON_WORD) || button;

  if (baseWord.querySelector('rt')) {
    baseWord = baseWord.cloneNode(true);
    baseWord.querySelectorAll('rt').forEach(it.remove());
  }

  return baseWord.textContent.trim();
}

/**
 * @returns {string[]} The list of all relevant words in the current answer.
 */
const getAnswerWords = () => (
  getAnswerWordButtons()
    .map(button => isDraggedWordButton(button) ? '' : getWordButtonWord(button))
    .filter(it.length > 0)
);

/**
 * Captures and reapplies the order of words in the current answer, so that the React UI takes it into account.
 *
 * This function uses a small delay between each operation, to account for the words animation.
 * @param {number} offset The number of words to skip from the beginning.
 * @returns {void}
 */
const applyFlyingWordsOrder = offset => {
  if (!lastWordBankSource) {
    return;
  }

  const sortedWords = [];
  const wordButtons = getAnswerWordButtons().slice(offset);

  if (OPTION_TIMING_NEVER !== options.disableWordAnimation) {
    toggleWordAnimation(false);
  }

  // Remove the necessary words one by one, to let everything animate smoothly.
  const removeAnswerWords = () => {
    const nextButton = wordButtons.shift();

    if (nextButton) {
      nextButton.click();

      if (!isDraggedWordButton(nextButton)) {
        const word = getWordButtonWord(nextButton);
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

  // Reinsert the removed words in the right order, one by one, again to let everything animate smoothly.
  const reinsertAnswerWords = () => {
    try {
      const sourceButtons = !lastWordBankSource
        ? []
        : Array.from(lastWordBankSource.querySelectorAll(SELECTOR_WORD_BUTTON));

      // Wait for all the removed words to have flied back in place.
      if (hasReinsertionStarted || !isAnyWordFlying()) {
        hasReinsertionStarted = true;
        const nextWord = sortedWords.shift();

        const nextButton = sourceButtons.find(button => (
          !isWordButtonDisabled(button)
          && (getWordButtonWord(button) === nextWord)
        ));

        nextButton && nextButton.click();
      }

      if (sortedWords.length > 0) {
        setTimeout(reinsertAnswerWords, 1);
      } else {
        setTimeout(restoreBaseState, 200);
      }
    } catch (error) {
      restoreBaseState();
      throw error;
    }
  };

  const restoreBaseState = () => {
    isReinsertingWords = false;
    isRearrangingWords = false;
    refreshWordButtonsState();

    if (OPTION_TIMING_ALWAYS !== options.disableWordAnimation) {
      toggleWordAnimation(true);
    }
  };

  removeAnswerWords();
}

/**
 * Captures and reapplies the order of words in the current answer, so that the React UI takes it into account.
 *
 * This function assumes that the words are not animated, and therefore does not use any delay.
 * @param {number} offset The number of words to skip from the beginning.
 * @param {Event|null} event The "drag" event at the origin of the new word order, if any.
 * @returns {void}
 */
const applyNonFlyingWordsOrder = (offset, event = null) => {
  if (!lastWordBankSource) {
    return;
  }

  const wordButtons = getAnswerWordButtons();

  const sortedWords = wordButtons
    .slice(offset)
    .map(button => {
      button.click();
      return isDraggedWordButton(button) ? '' : getWordButtonWord(button);
    })
    .filter(it.length > 0);

  if (event) {
    // Remove the additional button from the "draggable" plugin ourselves,
    // because it is not always automatically cleaned up.
    const dragSource = event.dragEvent.source;
    const fakeSourceWrapper = document.createElement('div');
    dragSource.parentNode.removeChild(dragSource);
    fakeSourceWrapper.appendChild(dragSource);
  }

  // TTS sounds will be played when words are reinserted - prevent this.
  isReinsertingWords = true;

  // Add the words back, in the right order.
  try {
    if (lastWordBankSource) {
      Array.from(lastWordBankSource.querySelectorAll(SELECTOR_WORD_BUTTON))
        .filter(!isWordButtonDisabled(_))
        .map(button => {
          const index = sortedWords.indexOf(getWordButtonWord(button));

          if (index >= 0) {
            // Do not reuse a same word button twice.
            sortedWords[index] = null;
          }

          return [ index, button ];
        })
        .filter(it[0] >= 0)
        .sort(lift(_[0] - _[0]))
        .forEach(it[1].click());
    }
  } finally {
    isReinsertingWords = false;
    isRearrangingWords = false;
    refreshWordButtonsState();
  }
}

/**
 * Captures and reapplies the order of words in the current answer, so that the React UI takes it into account.
 * @param {number} offset The number of words to skip from the beginning.
 * @param {Event|null} event The "drag" event at the origin of the new word order, if any.
 * @returns {void}
 */
const applyWordsOrder = (offset, event = null) => {
  isRearrangingWords = true;
  selectedWordButtonIndex = null;
  originalSelectedWordButtonIndex = null;

  if (isUsingFlyingWords) {
    applyFlyingWordsOrder(offset);
  } else {
    applyNonFlyingWordsOrder(offset, event);
  }
}

/**
 * Reflects the currently selected button on the UI.
 * @param {Element[]|null} buttons The word buttons of the current answer.
 * @returns {void}
 */
const refreshWordButtonsState = (buttons = null) => {
  (buttons || getAnswerWordButtons())
    .forEach((button, index) => {
      button.classList.toggle(
        CLASS_NAME_HIGHLIGHTED_WORD_BUTTON,
        index === selectedWordButtonIndex
      )
    });
}

/**
 * Selects the word button next to the currently selected one in a given direction.
 *
 * If no button has been selected yet, the first or last button will be selected.
 *
 * If there is no button in the given direction, no other button will be selected..
 * @param {string} direction A direction.
 * @returns {void}
 */
const selectNextWordButton = direction => {
  const wordButtons = getAnswerWordButtons();

  if (
    (0 === wordButtons.length)
    || ((DIRECTION_LEFT === direction) && (0 === selectedWordButtonIndex))
    || ((DIRECTION_RIGHT === direction) && (wordButtons.length - 1 === selectedWordButtonIndex))
  ) {
    selectedWordButtonIndex = null
  } else if (null === selectedWordButtonIndex) {
    selectedWordButtonIndex = (DIRECTION_RIGHT === direction) ? 0 : wordButtons.length - 1;
  } else {
    selectedWordButtonIndex += (DIRECTION_LEFT === direction) ? -1 : 1;
  }

  refreshWordButtonsState(wordButtons);
}

/**
 * Moves the currently selected word button in a given direction in the answer.
 * @param {string} direction A direction.
 * @returns {void}
 */
const moveSelectedWordButton = direction => {
  if (null !== selectedWordButtonIndex) {
    const wordButtons = getAnswerWordButtons();

    if (wordButtons[selectedWordButtonIndex]) {
      const selectedWrapper = wordButtons[selectedWordButtonIndex].closest(SELECTOR_DRAGGABLE_WORD);

      if (null === originalSelectedWordButtonIndex) {
        originalSelectedWordButtonIndex = selectedWordButtonIndex;
      }

      if (
        (DIRECTION_LEFT === direction)
        && (selectedWordButtonIndex > 0)
      ) {
        isMovingWord = true;

        selectedWrapper.parentNode.insertBefore(
          selectedWrapper,
          wordButtons[selectedWordButtonIndex - 1].closest(SELECTOR_DRAGGABLE_WORD)
        );

        selectedWordButtonIndex -= 1;
      } else if (
        (DIRECTION_RIGHT === direction)
        && (selectedWordButtonIndex < wordButtons.length - 1)
      ) {
        isMovingWord = true;

        selectedWrapper.parentNode.insertBefore(
          wordButtons[selectedWordButtonIndex + 1].closest(SELECTOR_DRAGGABLE_WORD),
          selectedWrapper
        );

        selectedWordButtonIndex += 1;
      }
    }
  }
}

/**
 * Removes the currently selected word button from the answer.
 * @returns {void}
 */
const removeSelectedWordButton = () => {
  if (null !== selectedWordButtonIndex) {
    // The mutation observer will take care of refreshing the state of the buttons.
    const wordButtons = getAnswerWordButtons();
    wordButtons[selectedWordButtonIndex]?.click();
  }
};

/**
 * Toggles on / off the animation of words.
 * @type {Function}
 * @param {boolean} enabled Whether words should be animated.
 * @returns {void}
 */
const toggleWordAnimation = enabled => {
  isWordAnimationDisabled = !enabled;
  document.body.classList.toggle(`_duo-wb-dnd_disabled_word_animation`, !isWordAnimationDisabled);
};

/**
 * Applies a new set of options.
 * @param {import('./options.js').Options} updated The new set of options.
 * @returns {void}
 */
const applyOptions = updated => {
  options = updated;

  if (OPTION_TIMING_NEVER === options.disableWordAnimation) {
    toggleWordAnimation(true);
  } else if (OPTION_TIMING_ALWAYS === options.disableWordAnimation) {
    toggleWordAnimation(false);
  } else if (OPTION_TIMING_ON_DND === options.disableWordAnimation) {
    toggleWordAnimation(!isRearrangingWords);
  }
};

// Load and apply the current set of options.
onUiLoaded(() => {
  sendActionRequestToContentScript(ACTION_TYPE_GET_OPTIONS)
    .catch(() => DEFAULT_OPTIONS)
    .then(applyOptions);
});

// Applies the new set of options every time a change occurs.
onBackgroundEvent((event, payload) => (BACKGROUND_EVENT_TYPE_OPTIONS_CHANGED === event) && applyOptions(payload));

// Observe mutations on overlay wrappers to detect whether words are animated,
// and tone down their animation when required.
const overlayMutationObserver = new MutationObserver(records => {
  if (lastOverlayWrapper?.querySelector(SELECTOR_OVERLAY_WORD_BUTTON)) {
    isUsingFlyingWords = true;
  }

  if (isWordAnimationDisabled) {
    for (const record of records) {
      for (const node of record.addedNodes) {
        const button = node.querySelector(SELECTOR_OVERLAY_WORD_BUTTON);

        if (button) {
          for (const animation of button.getAnimations()) {
            animation.finish();
          }
        }
      }
    }
  }
});

// Observe mutations on word-bank answers to detect external changes made to the list of words,
// and preserve the currently selected word button.
const wordBankAnswerMutationObserver = new MutationObserver(() => {
  if (
    (null !== selectedWordButtonIndex)
    && !isMovingWord
    && !isDraggingWord
    && !isRearrangingWords
  ) {
    const wordButtons = getAnswerWordButtons();
    let newSelectedIndex = wordButtons.findIndex(it.classList.contains(CLASS_NAME_HIGHLIGHTED_WORD_BUTTON));

    if ((-1 === newSelectedIndex) && (wordButtons.length > 0)) {
      newSelectedIndex = Math.max(
        0,
        Math.min(
          wordButtons.length - 1,
          selectedWordButtonIndex,
        )
      );
    }

    if (newSelectedIndex >= 0) {
      selectedWordButtonIndex = newSelectedIndex;
      refreshWordButtonsState(wordButtons);
    } else {
      selectedWordButtonIndex = null;
    }
  }
});

/**
 * Marks a word button from the current word-bank answer as dragged, or unmarks all of them.
 * @param {Element|null} button A word button, or null if all buttons should be unmarked.
 * @returns {void}
 */
const markDraggedWordButton = button => {
  lastWordBankAnswer
    ?.querySelectorAll(`.${CLASS_NAME_DRAGGED_WORD_BUTTON}`)
    ?.forEach(it.classList.remove(CLASS_NAME_DRAGGED_WORD_BUTTON));

  button?.classList.add(CLASS_NAME_DRAGGED_WORD_BUTTON);
};

/**
 * @returns {Element[]} The currently dragged word buttons.
 */
const getDraggedWordButtons = () => Array.from(
  lastWordBankAnswer?.getElementsByClassName(CLASS_NAME_DRAGGED_WORD_BUTTON) || []
);

/**
 * @param {Element} element A word element.
 * @returns {boolean} Whether the given word can be dragged natively.
 */
const isNativeDraggableWord = element => {
  const isDraggableProps = props => {
    if (isObject(props)) {
      if (true === props.draggable) {
        return true;
      } else if (isArray(props.children)) {
        return props.children.some(isDraggableProps(_?.props));
      } else if (isObject(props.children)) {
        return isDraggableProps(props.children.props);
      }
    }

    return false;
  };

  for (const [ key, value ] of Object.entries(element)) {
    if (key.match(/^__reactProps\$.+$/)) {
      return isDraggableProps(value);
    }
  }

  return false;
};

/**
 * @type {Function}
 * @param {?Element} element A word element that can be used to determine whether words are natively draggable.
 * @returns {boolean} Whether words are natively draggable.
 */
const isUsingNativeDnd = (() => {
  let isNativeDnd = false;

  return element => {
    if (!isNativeDnd && element) {
      isNativeDnd = isNativeDraggableWord(element.closest(SELECTOR_WORD) ?? element);
    }

    return isNativeDnd;
  };
})();

setInterval(() => {
  // Poll for new overlay wrappers to setup the detection of the words animation.
  const newOverlayWrapper = document.querySelector(SELECTOR_OVERLAY_WRAPPER);

  if (newOverlayWrapper !== lastOverlayWrapper) {
    overlayMutationObserver.disconnect();
    lastOverlayWrapper = newOverlayWrapper;

    if (!lastOverlayWrapper) {
      return;
    }

    overlayMutationObserver.observe(lastOverlayWrapper, { childList: true });
  }

  // Poll for new word-bank sources to setup the detection of clicks on word buttons.
  const newWordBankSource = document.querySelector(SELECTOR_WORD_SOURCE);

  if (newWordBankSource !== lastWordBankSource) {
    lastWordBankSource = newWordBankSource;

    if (lastWordBankSource) {
      lastWordBankSource.addEventListener('click', event => {
        if (event.target.matches('button') || event.target.closest('button')) {
          lastWordActionAt = Date.now();
        }
      });
    }
  }

  // Poll for new word-bank answers to setup the drag'n'drop plugin.
  const newWordBankAnswer = document.querySelector(SELECTOR_ANSWER);

  if (newWordBankAnswer !== lastWordBankAnswer) {
    lastWordBankAnswer = newWordBankAnswer;

    selectedWordButtonIndex = null;
    originalSelectedWordButtonIndex = null;

    if (!lastWordBankAnswer) {
      return;
    }

    wordBankAnswerMutationObserver.observe(
      lastWordBankAnswer,
      { childList: true, subtree: true }
    );

    if (isUsingNativeDnd(lastWordBankSource?.querySelector(SELECTOR_WORD_BUTTON))) {
      return;
    }

    const sortable = new Sortable(lastWordBankAnswer, {
      draggable: SELECTOR_DRAGGABLE_WORD,
      distance: 5,
    });

    sortable.removePlugin(Draggable.Plugins.Mirror);

    sortable.on('drag:start', event => {
      const draggableWord = event.originalSource.closest(SELECTOR_DRAGGABLE_WORD);

      if (
        !options.enableDnd
        || isMovingWord
        || !isChallengeUncompleted()
        || (draggableWord && isUsingNativeDnd(draggableWord))
      ) {
        event.cancel();
        return;
      }

      markDraggedWordButton(event.originalSource.querySelector(SELECTOR_WORD_BUTTON));

      isDraggingWord = true;
      originalAnswerWords = getAnswerWords();
    });

    sortable.on('sortable:stop', event => {
      isDraggingWord = false;

      if (null === isUsingFlyingWords) {
        isUsingFlyingWords = false;
      }

      const updatedAnswerWords = getAnswerWords();
      const draggedWordButtons = getDraggedWordButtons();
      const draggedWords = draggedWordButtons.map(getWordButtonWord(_));

      // Only reorder as many words as necessary.
      let preservedWordCount = Math.min(
        ...[
          // First difference between two words.
          originalAnswerWords.findIndex(lift(_ !== updatedAnswerWords[_])),
          // Account for false negatives that occur when a word is dragged to the left of the exact same word.
          ...draggedWords
            .map(updatedAnswerWords.indexOf(_))
            .filter(index => (
              (index >= 0)
              && (updatedAnswerWords[index] === updatedAnswerWords[index + 1])
            )),
          // Account for false negatives that occur when a word is dragged from the left of the exact same word.
          ...draggedWords
            .map(originalAnswerWords.indexOf(_))
            .filter(index => (
              (index >= 0)
              && (originalAnswerWords[index] === originalAnswerWords[index + 1])
              && (updatedAnswerWords[index] !== updatedAnswerWords[index + 1])
            )),
        ].filter(lift(_ >= 0))
      );

      if ((-1 === preservedWordCount) || (Infinity === preservedWordCount)) {
        if (updatedAnswerWords.length > originalAnswerWords.length) {
          preservedWordCount = originalAnswerWords.length;
        } else {
          markDraggedWordButton(null);
          return;
        }
      }

      applyWordsOrder(preservedWordCount, event);
    });
  }
}, 50);

// Prevent TTS words from being played when necessary.
onSoundPlaybackRequested(sound => !(
  (SOUND_TYPE_TTS_WORD === sound.type)
  && (
    isReinsertingWords
    || (
      options.disableWordButtonsTts
      && (Math.abs(Date.now() - lastWordActionAt) <= WORD_ACTION_TTS_DELAY)
    )
  )
));

/**
 * Attempts to acquire the hotkeys mutex whenever it becomes available, but with the lowest possible priority,
 * always giving back control when another extension requests it (unless a word is being moved around).
 * @returns {void}
 */
const requestHotkeysMutex = () => {
  if (
    hasPendingHotkeysMutexRequest
    || hotkeysMutexReleaseCallback
  ) {
    return;
  }

  hasPendingHotkeysMutexRequest = true;

  requestMutex(
    MUTEX_HOTKEYS,
    {
      priority: PRIORITY_LOWEST,
      onSupersessionRequest: () => {
        if (hotkeysMutexReleaseCallback && !isMovingWord) {
          hotkeysMutexReleaseCallback();
          hotkeysMutexReleaseCallback = null;
          requestHotkeysMutex();
        }
      },
    }
  ).then(releaseCallback => {
    hasPendingHotkeysMutexRequest = false;
    hotkeysMutexReleaseCallback = releaseCallback;
  }).catch(noop);
};

requestHotkeysMutex();

/**
 * @returns {boolean} Whether the current context is an uncompleted challenge.
 */
const isChallengeUncompleted = () => {
  const context = getCurrentContext();
  return (CONTEXT_CHALLENGE === context.type) && !context.isCompleted;
};

document.addEventListener('keydown', event => {
  if (isDraggingWord) {
    if ('Backspace' === event.key) {
      // Do not allow the user to remove words from the answer when dragging a word,
      // because it could mess things up (adding words is fine though).
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  } else if (
    lastWordBankAnswer
    && !isRearrangingWords
    && (null !== hotkeysMutexReleaseCallback)
    && options.enableKeyboardShortcuts
    && isChallengeUncompleted()
    && !isAnyInputFocused()
  ) {
    if ('ArrowLeft' === event.key) {
      discardEvent(event);

      if (event.ctrlKey) {
        moveSelectedWordButton(DIRECTION_LEFT);
      } else {
        selectNextWordButton(DIRECTION_LEFT);
      }
    } else if ('ArrowRight' === event.key) {
      discardEvent(event);

      if (event.ctrlKey) {
        moveSelectedWordButton(DIRECTION_RIGHT);
      } else {
        selectNextWordButton(DIRECTION_RIGHT);
      }
    } else if (!event.ctrlKey) {
      if ('Delete' === event.key) {
        discardEvent(event);
        removeSelectedWordButton();
      }
    }
  }

  if (lastWordBankAnswer) {
    lastWordActionAt = Date.now();
  }
}, true);

document.addEventListener('keyup', event => {
  if ('Control' === event.key) {
    if (isMovingWord && (selectedWordButtonIndex !== originalSelectedWordButtonIndex)) {
      applyWordsOrder(
        Math.max(
          0,
          Math.min(selectedWordButtonIndex, originalSelectedWordButtonIndex)
        )
      );
    }

    isMovingWord = false;
  }
});

/**
 * The number of milliseconds during which not to play TTS after a word action occurred.
 * @type {number}
 */
const WORD_ACTION_TTS_DELAY = 100;

/**
 * @type {string}
 */
const DIRECTION_LEFT = 'left';

/**
 * @type {string}
 */
const DIRECTION_RIGHT = 'right';

/**
 * A CSS selector for overlay wrappers.
 * @type {string}
 */
const SELECTOR_OVERLAY_WRAPPER = '#overlays';

/**
 * A CSS selector for word-bank answers.
 * @type {string}
 */
const SELECTOR_ANSWER = '.PcKtj';

/**
 * A CSS selector for sources of words.
 * @type {string}
 */
const SELECTOR_WORD_SOURCE = '[data-test="word-bank"]';

/**
 * The possible CSS selectors for the wrappers of word buttons.
 * @type {string[]}
 */
const WORD_SELECTORS = [ '._1yW4j', '.JSl9i', '._2LmyT' ];

/**
 * A CSS selector for the wrappers of word buttons anywhere on the page.
 * @type {string}
 */
const SELECTOR_WORD = WORD_SELECTORS.join(',');

/**
 * A CSS selector for the word buttons anywhere on the page.
 * @type {string}
 */
const SELECTOR_WORD_BUTTON = WORD_SELECTORS.map(`${it} button`).join(',');

/**
 * A CSS selector for the wrappers of word buttons in word-bank answers.
 * @type {string}
 */
const SELECTOR_DRAGGABLE_WORD = WORD_SELECTORS.map(`${SELECTOR_ANSWER} ${it}`).join(',');

/**
 * A CSS selector for flying word buttons in the overlay wrapper.
 * @type {string}
 */
const SELECTOR_OVERLAY_WORD_BUTTON = 'button._1O290';

/**
 * The class name that can be added to a word button to highlight it.
 *
 * Copied by searching for a suitable class in the "sessions" stylesheet,
 * while taking into account the fact that parts of the words may already be highlighted if the keyboard was used.
 * @type {string}
 */
const CLASS_NAME_HIGHLIGHTED_WORD_BUTTON = 'pmjld';

/**
 * The class name that is added to the original word button when a word is dragged.
 * @type {string}
 */
const CLASS_NAME_DRAGGED_WORD_BUTTON = '_dnd_-dragged-word-button';

/**
 * A CSS selector for the word inside word buttons.
 * @type {string}
 */
const SELECTOR_WORD_BUTTON_WORD = '._2J2do, ._3PW0K';

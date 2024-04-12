(function () {
  'use strict';

  /**
   * @param {number} delay A delay, in milliseconds.
   * @returns {Promise<void>} A promise for when the delay is elapsed.
   */

  const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));

  /**
   * @type {string}
   */

  const UNIQUE_KEY_PREFIX = '__duo-toolbox__-';
  /**
   * @type {Function}
   * @param {string} baseKey A key.
   * @returns {string} The given key, uniquely prefixed.
   */

  const getUniqueKey = _arg => {
    return `${UNIQUE_KEY_PREFIX}${_arg}`;
  };

  /**
   * @type {string}
   */

  const ACTION_RESULT_SUCCESS = 'success';
  /**
   * @type {string}
   */

  const MESSAGE_TYPE_ACTION_REQUEST = getUniqueKey('action_request');
  /**
   * Sends an action request from a content / options / popup script to the background scripts.
   *
   * @type {Function}
   * @param {string} action The action key.
   * @param {*=} value The action payload.
   * @returns {Promise} A promise for the result of the action.
   */

  const sendActionRequestToBackgroundScript = async (action, value) => sendMessageToBackgroundScript({
    type: MESSAGE_TYPE_ACTION_REQUEST,
    action,
    value
  }).then(result => {
    if (ACTION_RESULT_SUCCESS === (result === null || result === void 0 ? void 0 : result.type)) {
      return result.value || null;
    } else {
      throw new Error((result === null || result === void 0 ? void 0 : result.error) || `An error occurred while processing a "${action}" action.`);
    }
  });
  /**
   * Sends a message from a content / options / popup script to the background scripts.
   *
   * @type {Function}
   * @param {object} data The message payload.
   * @returns {Promise} A promise for the result of processing the message.
   */

  const sendMessageToBackgroundScript = async data => new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined') {
      chrome.runtime.sendMessage(data, result => {
        if (!chrome.runtime.lastError) {
          resolve(result);
        } else {
          reject(chrome.runtime.lastError);
        }
      });
    } else {
      return browser.runtime.sendMessage(data);
    }
  });

  /**
   * @type {string}
   */
  const ACTION_TYPE_GET_OPTIONS = 'get_options';

  /**
   * @type {string}
   */
  const ACTION_TYPE_UPDATE_OPTIONS = 'update_options';

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
  const OPTION_TIMING_NEVER = 'never';

  /**
   * @type {Options}
   */
  const DEFAULT_OPTIONS = {
    enableDnd: true,
    enableKeyboardShortcuts: true,
    disableWordButtonsTts: false,
    disableWordAnimation: OPTION_TIMING_NEVER
  };

  /**
   * @type {string}
   */
  const LOADING_CLASS_NAME = 'is-loading';

  /**
   * @type {{[key: string]: Element}}
   */
  const configCheckboxes = Object.fromEntries(Array.from(document.querySelectorAll('input[type="checkbox"]')).map(_it => {
    return [_it.name, _it];
  }));

  /**
   * @type {{[key: string]: {[key: string]: Element}}}
   */
  const configRadioGroups = Array.from(document.querySelectorAll('input[type="radio"]')).reduce((groups, radio) => {
    !groups[radio.name] && (groups[radio.name] = {});
    groups[radio.name][radio.value] = radio;
    return groups;
  }, {});

  /**
   * @type {Element[]}
   */
  const configFields = [...Object.values(configCheckboxes), ...Object.values(configRadioGroups).flatMap(_arg => {
    return Object.values(_arg);
  })];

  /**
   * @param {string} name The name of a field.
   * @returns {*|undefined} The value of the given field.
   */
  function getFieldValue(name) {
    if (configCheckboxes[name]) {
      return configCheckboxes[name].checked;
    }
    if (configRadioGroups[name]) {
      var _Object$values$find;
      return (_Object$values$find = Object.values(configRadioGroups[name]).find(_it2 => {
        return _it2.checked;
      })) === null || _Object$values$find === void 0 ? void 0 : _Object$values$find.value;
    }
    return undefined;
  }

  /**
   * @param {Function} callback The function to execute while in loading mode.
   * @param {number} minimumDelay The minimum duration of the loading mode.
   * @returns {Promise<void>} A promise for when the loading is complete.
   */
  async function whileLoading(callback) {
    let minimumDelay = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    document.body.classList.add(LOADING_CLASS_NAME);
    configFields.forEach(_it3 => {
      return _it3.disabled = true;
    });
    try {
      await Promise.all([callback(), sleep(minimumDelay)]);
    } finally {
      configFields.forEach(_it4 => {
        return _it4.disabled = false;
      });
      document.body.classList.remove(LOADING_CLASS_NAME);
    }
  }

  // Update the options when a change is made.
  configFields.forEach(_it5 => {
    return _it5.addEventListener('change', event => whileLoading(() => sendActionRequestToBackgroundScript(ACTION_TYPE_UPDATE_OPTIONS, {
      [event.target.name]: getFieldValue(event.target.name)
    }), 250));
  });

  // Initialize the form values.
  whileLoading(() => sendActionRequestToBackgroundScript(ACTION_TYPE_GET_OPTIONS).catch(() => DEFAULT_OPTIONS).then(options => {
    for (const [key, value] of Object.entries(options)) {
      var _configRadioGroups$ke;
      if (configCheckboxes[key]) {
        configCheckboxes[key].checked = !!value;
      } else if ((_configRadioGroups$ke = configRadioGroups[key]) !== null && _configRadioGroups$ke !== void 0 && _configRadioGroups$ke[value]) {
        configRadioGroups[key][value].checked = true;
      }
    }
    document.body.classList.remove(LOADING_CLASS_NAME);
  }));

})();

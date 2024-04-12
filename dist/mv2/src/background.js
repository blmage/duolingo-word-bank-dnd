(function () {
  'use strict';

  const callAsAsync = (area, functionName, ...parameters) => new Promise(
    (resolve, reject) => {
      parameters.push(result => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });

      area[functionName](...parameters);
    }
  );

  const ChromeStorage = {
    local: {
      onChanged: listener => chrome.storage.local.onChanged(listener),
      clear: () => callAsAsync(chrome.storage.local, 'clear'),
      get: keys => callAsAsync(chrome.storage.local, 'get', keys),
      getBytesInUse: keys => callAsAsync(chrome.storage.local, 'getBytesInUse', keys),
      remove: keys => callAsAsync(chrome.storage.local, 'remove', keys),
      set: items => callAsAsync(chrome.storage.local, 'set', items),
    },
    managed: {
      onChanged: listener => chrome.storage.managed.onChanged(listener),
      clear: () => callAsAsync(chrome.storage.managed, 'clear'),
      get: keys => callAsAsync(chrome.storage.managed, 'get', keys),
      getBytesInUse: keys => callAsAsync(chrome.storage.managed, 'getBytesInUse', keys),
      remove: keys => callAsAsync(chrome.storage.managed, 'remove', keys),
      set: items => callAsAsync(chrome.storage.managed, 'set', items),
    },
    sync: {
      onChanged: listener => chrome.storage.sync.onChanged(listener),
      clear: () => callAsAsync(chrome.storage.sync, 'clear'),
      get: keys => callAsAsync(chrome.storage.sync, 'get', keys),
      getBytesInUse: keys => callAsAsync(chrome.storage.sync, 'getBytesInUse', keys),
      remove: keys => callAsAsync(chrome.storage.sync, 'remove', keys),
      set: items => callAsAsync(chrome.storage.sync, 'set', items),
    },
  };

  /**
   * @type {Function}
   * @param {*} value The tested value.
   * @returns {boolean} Whether the given value is an array.
   */

  const isArray = Array.isArray;
  /**
   * @type {Function}
   * @param {*} value The tested value.
   * @returns {boolean} Whether the given value is an object. This excludes Arrays, but not Dates or RegExps.
   */

  const isObject = _arg2 => {
    return 'object' === typeof _arg2 && !!_arg2 && !isArray(_arg2);
  };

  /**
   * A match pattern for Duolingo URLs.
   *
   * @type {string}
   */
  const DUOLINGO_URL_PATTERN = 'https://*.duolingo.com/*';

  /**
   * Checks the value of chrome.runtime.lastError, and does nothing else.
   *
   * This is especially useful as a callback to chrome.* functions, when their result does not matter.
   *
   * @returns {void}
   */

  const discardLastRuntimeError = () => {
    if (chrome.runtime.lastError) {
      return;
    }
  };
  /**
   * Enables or disables the extension popup on a browser tab, depending on whether it is browsing a Duolingo page.
   *
   * @param {Object} tab A browser tab.
   * @returns {void}
   */

  const togglePopupOnTab = tab => {
    if (tab !== null && tab !== void 0 && tab.id) {
      var _chrome$pageAction, _chrome$pageAction2;

      (tab.url || '').match(/^https:\/\/.*duolingo\.com\//) ? (((_chrome$pageAction = chrome.pageAction) === null || _chrome$pageAction === void 0 ? void 0 : _chrome$pageAction.show) || chrome.action.enable)(tab.id, discardLastRuntimeError) : (((_chrome$pageAction2 = chrome.pageAction) === null || _chrome$pageAction2 === void 0 ? void 0 : _chrome$pageAction2.hide) || chrome.action.disable)(tab.id, discardLastRuntimeError);
      chrome.runtime.lastError && setTimeout(() => togglePopupOnTab(tab), 50);
    }
  };
  /**
   * Applies a callback to a given tab.
   *
   * @param {number} tabId The ID of a tab.
   * @param {Function} callback The callback to apply to the given tab.
   * @returns {void}
   */


  const withTab = (tabId, callback) => chrome.tabs.get(tabId, tab => {
    var _chrome$runtime$lastE;

    return (// Work-around for https://bugs.chromium.org/p/chromium/issues/detail?id=1213925
      ((_chrome$runtime$lastE = chrome.runtime.lastError) === null || _chrome$runtime$lastE === void 0 ? void 0 : _chrome$runtime$lastE.message) !== 'Tabs cannot be edited right now (user may be dragging a tab).' ? callback(tab) : setTimeout(() => withTab(tabId, callback), 100)
    );
  });
  /**
   * Registers the necessary event listeners for the extension popup to be enabled on Duolingo pages.
   *
   * @returns {void}
   */


  const registerPopupActivationListeners = () => {
    chrome.tabs.onUpdated.addListener((tabId, tab) => tabId && (tab !== null && tab !== void 0 && tab.id ? togglePopupOnTab(tab) : withTab(tabId, togglePopupOnTab)));
    chrome.tabs.onActivated.addListener(({
      tabId
    }) => tabId && withTab(tabId, togglePopupOnTab));
  };

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

  const ACTION_RESULT_FAILURE = 'failure';
  /**
   * @type {string}
   */

  const ACTION_RESULT_SUCCESS = 'success';
  /**
   * @type {string}
   */

  const MESSAGE_TYPE_ACTION_REQUEST = getUniqueKey('action_request');
  /**
   * @type {string}
   */

  const MESSAGE_TYPE_BACKGROUND_EVENT_NOTIFICATION = getUniqueKey('background_event_notification');
  /**
   * Sends an event notification from a background script to the content / options / popup scripts.
   *
   * @type {Function}
   * @param {string} event The event key.
   * @param {*=} value The event payload.
   * @returns {void}
   */

  const sendBackgroundEventNotificationToPageScript = async (event, value) => {
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPE_BACKGROUND_EVENT_NOTIFICATION,
        event,
        value
      });
    } catch (error) {// Most certainly nobody is listening, but we don't care whether we are heard or not here.
    }

    await chrome.tabs.query({
      url: DUOLINGO_URL_PATTERN
    }, async tabs => {
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: MESSAGE_TYPE_BACKGROUND_EVENT_NOTIFICATION,
            event,
            value
          });
        } catch (error) {
          if (chrome.runtime.lastError) ;
        }
      }
    });
  };
  /**
   * Registers a listener for action requests.
   *
   * This function must be called from a script with access to the extension messages.
   *
   * @type {Function}
   * @param {Function} callback
   * The async function to be called when an action request is sent, with these parameters:
   * - the action type,
   * - the action payload,
   * - an object containing information about the context of the script that sent the request,
   * - a function usable to send back the result of the action.
   * - a function usable to send back an error instead.
   * When the function is resolved, if neither a result nor an error was sent, a generic error will be sent instead.
   * @returns {void}
   */

  const onActionRequest = callback => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (MESSAGE_TYPE_ACTION_REQUEST === message.type) {
        let isResponseSent = false;

        const sendResult = value => {
          isResponseSent = true;
          sendResponse({
            type: ACTION_RESULT_SUCCESS,
            value
          });
        };

        const sendError = error => {
          isResponseSent = true;
          sendResponse({
            type: ACTION_RESULT_FAILURE,
            error
          });
        };

        try {
          Promise.resolve(callback(message.action, message.value, sender, sendResult, sendError)).then(() => {
            if (!isResponseSent) {
              throw new Error(`Could not handle action request: "${message.action}".`);
            }
          }).catch(error => {
            if (!isResponseSent) {
              sendError(error);
            }
          });
        } catch (error) {
          !isResponseSent && sendError(error);
        }

        return true;
      }
    });
  };

  /**
   * @type {string}
   */
  const ACTION_TYPE_GET_OPTIONS = 'get_options';

  /**
   * @type {string}
   */
  const ACTION_TYPE_UPDATE_OPTIONS = 'update_options';

  /**
   * @type {string}
   */
  const BACKGROUND_EVENT_TYPE_OPTIONS_CHANGED = 'options_changed';

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
   * @param {...Options} optionSets One or more sets of options.
   * @returns {Options} The combination of the given sets of options.
   */
  function mergeOptions() {
    for (var _len = arguments.length, optionSets = new Array(_len), _key = 0; _key < _len; _key++) {
      optionSets[_key] = arguments[_key];
    }
    const result = Object.assign({}, ...optionSets);
    for (const key of Object.keys(result)) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_OPTIONS, key)) {
        delete result[key];
      }
    }
    return result;
  }

  /**
   * @type {string}
   */
  const STORAGE_KEY_OPTIONS = 'options';

  /**
   * @param {Function} sendResult A function usable to send back the current set of options.
   * @returns {Promise<void>}
   */
  const handleOptionsRequest = async sendResult => {
    const options = await ChromeStorage.sync.get(STORAGE_KEY_OPTIONS);
    sendResult(mergeOptions(DEFAULT_OPTIONS, options[STORAGE_KEY_OPTIONS] || {}));
  };

  /**
   * @param {object} data A new set of options.
   * @param {Function} sendResult A function usable to notify the success of the update.
   * @returns {Promise<void>}
   */
  const handleOptionsUpdateRequest = async (data, sendResult) => {
    if (isObject(data)) {
      const result = await ChromeStorage.sync.get(STORAGE_KEY_OPTIONS);
      const updatedOptions = mergeOptions(DEFAULT_OPTIONS, result[STORAGE_KEY_OPTIONS] || {}, data);
      await ChromeStorage.sync.set({
        [STORAGE_KEY_OPTIONS]: updatedOptions
      });
      sendResult();
      sendBackgroundEventNotificationToPageScript(BACKGROUND_EVENT_TYPE_OPTIONS_CHANGED, updatedOptions);
    }
  };
  onActionRequest(async (action, data, sender, sendResult) => {
    switch (action) {
      case ACTION_TYPE_GET_OPTIONS:
        await handleOptionsRequest(sendResult);
        break;
      case ACTION_TYPE_UPDATE_OPTIONS:
        await handleOptionsUpdateRequest(data, sendResult);
        break;
    }
  });
  registerPopupActivationListeners();

})();

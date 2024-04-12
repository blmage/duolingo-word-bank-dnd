(function () {
  'use strict';

  /**
   * A function that does nothing.
   *
   * @returns {void}
   */

  const noop = () => {};
  /**
   * @param {Promise} promise A promise to run solely for its effects, discarding its result.
   * @returns {void}
   */

  const runPromiseForEffects = _it => {
    return _it.then(noop).catch(noop);
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

  const MESSAGE_TYPE_ACTION_RESULT = getUniqueKey('action_result');
  /**
   * @type {string}
   */

  const MESSAGE_TYPE_UI_EVENT_NOTIFICATION = getUniqueKey('ui_event_notification');
  /**
   * @type {string}
   */

  const MESSAGE_TYPE_BACKGROUND_EVENT_NOTIFICATION = getUniqueKey('background_event_notification');
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
   * Registers a listener for background events.
   *
   * This function can be called from any script.
   *
   * @param {Function} callback
   * The function to be called when a background event is fired, with the event type and payload as parameters.
   * @param {(string[])=} eventTypes
   * The types of background events that the listener should be notified of, if not all.
   * @returns {Function}
   * A function usable to unregister the event listener.
   */

  const onBackgroundEvent = (callback, eventTypes) => {
    var _chrome$runtime;

    const isRelevantEventType = !isArray(eventTypes) ? () => true : _arg => {
      return eventTypes.indexOf(_arg) >= 0;
    };

    const listener = event => {
      const eventData = isObject(event.data) ? event.data : event;
      return eventData && MESSAGE_TYPE_BACKGROUND_EVENT_NOTIFICATION === eventData.type && isRelevantEventType(eventData.event) && callback(eventData.event, eventData.value);
    };

    if (typeof chrome !== 'undefined' && (_chrome$runtime = chrome.runtime) !== null && _chrome$runtime !== void 0 && _chrome$runtime.onMessage) {
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  };
  /**
   * Sets up a bridge between UI scripts and background scripts on a content script, that forwards:
   * - event notifications,
   * - action requests,
   * - action results.
   *
   * @type {Function}
   * @param {string[]} actionTypes
   * The types of action requests that should be forwarded to the background scripts, if not all.
   * @param {string[]} uiEventTypes
   * The types of UI events that should be forwarded to the background scripts, if not all.
   * @param {string[]} backgroundEventTypes
   * The types of background events that should be forwarded to the UI scripts, if not all.
   * @returns {Function}
   * A function usable to stop forwarding event notifications and action requests.
   */

  const setupContentScriptBridge = (actionTypes, uiEventTypes, backgroundEventTypes) => {
    const isRelevantActionType = !isArray(actionTypes) ? () => true : _arg2 => {
      return actionTypes.indexOf(_arg2) >= 0;
    }; // Forward event notifications from the background script to the UI scripts.

    const unregisterBackgroundListener = onBackgroundEvent((event, value) => {
      window.postMessage({
        type: MESSAGE_TYPE_BACKGROUND_EVENT_NOTIFICATION,
        event,
        value
      }, '*');
    }, backgroundEventTypes); // Forward action requests from UI scripts to the background scripts.
    // Forward action results from background scripts to the UI scripts.

    const uiListener = event => {
      if (event.source === window && isObject(event.data)) {
        if (MESSAGE_TYPE_ACTION_REQUEST === event.data.type) {
          const action = event.data.action || null;

          if (isRelevantActionType(action)) {
            sendMessageToBackgroundScript(event.data).then(result => {
              if (!isObject(result) || ACTION_RESULT_SUCCESS !== result.type) {
                throw new Error();
              }

              return result.value;
            }).then(value => {
              event.source.postMessage({
                type: MESSAGE_TYPE_ACTION_RESULT,
                action,
                result: ACTION_RESULT_SUCCESS,
                value
              }, '*');
            }).catch(error => {
              event.source.postMessage({
                type: MESSAGE_TYPE_ACTION_RESULT,
                action,
                result: ACTION_RESULT_FAILURE,
                error
              }, '*');
            });
          }
        } else if (MESSAGE_TYPE_UI_EVENT_NOTIFICATION === event.data.type) {
          const eventType = event.data.event || null;

          if (uiEventTypes.indexOf(eventType) >= 0) {
            runPromiseForEffects(sendMessageToBackgroundScript(event.data));
          }
        }
      }
    };

    window.addEventListener('message', uiListener);
    return () => {
      unregisterBackgroundListener();
      window.removeEventListener('message', uiListener);
    };
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
   * @type {string[]}
   */
  const ACTION_TYPES = [ACTION_TYPE_GET_OPTIONS, ACTION_TYPE_UPDATE_OPTIONS];

  /**
   * @type {string}
   */
  const BACKGROUND_EVENT_TYPE_OPTIONS_CHANGED = 'options_changed';

  /**
   * @type {string[]}
   */
  const BACKGROUND_EVENT_TYPES = [BACKGROUND_EVENT_TYPE_OPTIONS_CHANGED];

  const observerScript = document.createElement('script');
  observerScript.src = chrome.runtime.getURL('src/observer.js');
  observerScript.type = 'text/javascript';
  (document.head || document.documentElement).appendChild(observerScript);
  const uiScript = document.createElement('script');
  uiScript.src = chrome.runtime.getURL('src/ui.js');
  uiScript.type = 'text/javascript';
  (document.head || document.documentElement).appendChild(uiScript);
  const uiStyleSheet = document.createElement('link');
  uiStyleSheet.href = chrome.runtime.getURL('assets/css/ui.css');
  uiStyleSheet.rel = 'stylesheet';
  (document.head || document.documentElement).appendChild(uiStyleSheet);
  setupContentScriptBridge(ACTION_TYPES, [], BACKGROUND_EVENT_TYPES);

})();

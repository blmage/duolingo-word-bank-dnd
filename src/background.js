import ChromeStorage from 'chrome-storage-promise';
import { isObject } from 'duo-toolbox/utils/functions';
import { registerPopupActivationListeners } from 'duo-toolbox/extension/background';
import { onActionRequest, sendBackgroundEventNotificationToPageScript } from 'duo-toolbox/extension/ipc';
import { ACTION_TYPE_GET_OPTIONS, ACTION_TYPE_UPDATE_OPTIONS, BACKGROUND_EVENT_TYPE_OPTIONS_CHANGED } from './ipc';
import { DEFAULT_OPTIONS, mergeOptions } from './options';

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

    const updatedOptions = mergeOptions(
      DEFAULT_OPTIONS,
      result[STORAGE_KEY_OPTIONS] || {},
      data
    );

    await ChromeStorage.sync.set({ [STORAGE_KEY_OPTIONS]: updatedOptions });

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

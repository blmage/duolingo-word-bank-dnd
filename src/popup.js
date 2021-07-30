import { _, it } from 'one-liner.macro';
import { sleep } from 'duo-toolbox/utils/functions';
import { sendActionRequestToBackgroundScript } from 'duo-toolbox/extension/ipc';
import { ACTION_TYPE_GET_OPTIONS, ACTION_TYPE_UPDATE_OPTIONS } from './ipc';
import { DEFAULT_OPTIONS } from './options';

/**
 * @type {string}
 */
const LOADING_CLASS_NAME = 'is-loading';

/**
 * @type {Object<string, Element>}
 */
const configCheckboxes = Object.fromEntries(
  Array.from(document.querySelectorAll('input[type="checkbox"]'))
    .map([ it.name, it ])
);

/**
 * @type {Object<string, Object<string, Element>>}
 */
const configRadioGroups = Array.from(document.querySelectorAll('input[type="radio"]'))
  .reduce((groups, radio) => {
    !groups[radio.name] && (groups[radio.name] = {});
    groups[radio.name][radio.value] = radio;
    return groups;
  }, {});

/**
 * @type {Element[]}
 */
const configFields = [
  ...Object.values(configCheckboxes),
  ...Object.values(configRadioGroups).flatMap(Object.values(_)),
];

/**
 * @param {string} name The name of a field.
 * @returns {*|undefined} The value of the given field.
 */
function getFieldValue(name) {
  if (configCheckboxes[name]) {
    return configCheckboxes[name].checked;
  }

  if (configRadioGroups[name]) {
    return Object.values(configRadioGroups[name]).find(it.checked)?.value;
  }

  return undefined;
}

/**
 * @param {Function} callback The function to execute while in loading mode.
 * @param {number} minimumDelay The minimum duration of the loading mode.
 * @returns {Promise<void>} A promise for when the loading is complete.
 */
async function whileLoading(callback, minimumDelay = 0) {
  document.body.classList.add(LOADING_CLASS_NAME);
  configFields.forEach(it.disabled = true);

  try {
    await Promise.all([
      callback(),
      sleep(minimumDelay)
    ]);
  } finally {
    configFields.forEach(it.disabled = false);
    document.body.classList.remove(LOADING_CLASS_NAME);
  }
}

// Update the options when a change is made.
configFields.forEach(
  it.addEventListener(
    'change',
    event => (
      whileLoading(() => (
        sendActionRequestToBackgroundScript(
          ACTION_TYPE_UPDATE_OPTIONS,
          { [event.target.name]: getFieldValue(event.target.name) }
        )
      ), 250)
    )
  )
);

// Initialize the form values.
whileLoading(() => (
  sendActionRequestToBackgroundScript(ACTION_TYPE_GET_OPTIONS)
    .catch(() => DEFAULT_OPTIONS)
    .then(options => {
      for (const [ key, value ] of Object.entries(options)) {
        if (configCheckboxes[key]) {
          configCheckboxes[key].checked = !!value;
        } else if (configRadioGroups[key]?.[value]) {
          configRadioGroups[key][value].checked = true;
        }
      }

      document.body.classList.remove(LOADING_CLASS_NAME);
    })
));

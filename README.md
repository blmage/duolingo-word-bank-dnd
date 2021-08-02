<h1>
  <img align="center" width="48" height="48" src="https://raw.githubusercontent.com/blmage/duolingo-word-bank-dnd/master/dist/icons/icon_48.png" />
  Duolingo Word Bank Dnd
</h1>

[![DeepScan grade](https://deepscan.io/api/teams/9459/projects/12778/branches/202380/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=9459&pid=12778&bid=202380)
![ESLint](https://github.com/blmage/duolingo-word-bank-dnd/workflows/ESLint/badge.svg)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fblmage%2Fduolingo-word-bank-dnd.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fblmage%2Fduolingo-word-bank-dnd?ref=badge_shield)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/dfpfeeojcakkdfiglfcccdlhdfejcmkg)](https://chrome.google.com/webstore/detail/duolingo-word-bank-dnd/dfpfeeojcakkdfiglfcccdlhdfejcmkg)
[![Mozilla Add-on](https://img.shields.io/amo/v/duolingo-word-bank-dnd)](https://addons.mozilla.org/fr/firefox/addon/duolingo-word-bank-dnd/)

A minimal browser extension for enabling the **drag'n'drop of words** in the **word-bank answers** on
[Duolingo](https://www.duolingo.com).

### Table of contents

* [Download](#download)
* [Demo](#demo)
* [Customization options](#customization-options)
* [Keyboard shortcuts](#keyboard-shortcuts)
* [Limitations](#limitations)
* [Bug reports and feature requests](#bug-reports-and-feature-requests)

### Download

* [**Chrome** extension](https://chrome.google.com/webstore/detail/duolingo-word-bank-dnd/dfpfeeojcakkdfiglfcccdlhdfejcmkg)
* [**Firefox** add-on](https://addons.mozilla.org/fr/firefox/addon/duolingo-word-bank-dnd/)
* [**Opera** addon](https://addons.opera.com/fr/extensions/details/duolingo-word-bank-dnd/)

### Demo

<img src="https://i.imgur.com/7HzpWat.gif" alt="Demo" width="600" />

### Customization options

Click on the 
<img align="center" width="16" height="16" src="https://raw.githubusercontent.com/blmage/duolingo-word-bank-dnd/master/dist/icons/icon_48.png" /> 
extension icon in your browser toolbar to open the customization popup:

<img width="312" height="230" src="https://raw.githubusercontent.com/blmage/duolingo-word-bank-dnd/assets_v2/screenshots/popup.png" />

Any change you apply will immediately take effect.

#### Enable drag'n'drop

*Default: Enabled*

When this option is enabled, words can be moved around in answers using the mouse.

#### Enable keyboard shortcuts

*Default: Enabled*

When this option is enabled, words can be moved around in anwsers using the keyboard 
(see [keyboard shortcuts](#keyboard-shortcuts)).

#### Do not play TTS when adding words to answers

*Default: Disabled*

When this option is enabled, words will never be read aloud when added to an answer.

#### Tone down word animation

*Default: Never*

When this option is enabled, the "flying words" animation will be "softened" as much as possible:

| Without       | With          |
| ------------- | ------------- |
| <img align="center" width="300" height="268" src="https://raw.githubusercontent.com/blmage/duolingo-word-bank-dnd/assets_v2/demos/option_dnd_flying_words.gif" /> | <img align="center" width="300" height="268" src="https://raw.githubusercontent.com/blmage/duolingo-word-bank-dnd/assets_v2/demos/option_dnd_no_flying_words.gif" /> |


### Keyboard shortcuts

When a word bank is active (and no other extension has the focus), use:

- the `←` / `→` arrows to select a word,

- the `←` / `→` arrows while holding `Ctrl` to move the selected word in the answer
  (release `Ctrl` to apply the new position),

- `Del` to remove the selected word from the answer,

- `Backspace` to remove the last word of the answer.
  

### Limitations

* The extension is deeply tied to the inner workings of [Duolingo](https://www.duolingo.com), meaning that 
  significant changes on their side could (temporarily) break it. If that happens, you can either:
  
    * wait for me to fix it (you can
      [open an issue](https://github.com/blmage/duolingo-word-bank-dnd/issues/new) if there is none yet about it),
      
    * if you're a developer, try to fix it yourself, then
      [open a related PR](https://github.com/blmage/duolingo-word-bank-dnd/compare).

### Bug reports and feature requests

If you encounter a bug, or if you have a suggestion regarding a new feature, don't hesitate to
[open a related issue](https://github.com/blmage/duolingo-word-bank-dnd/issues/new)!

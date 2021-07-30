import { noop } from 'duo-toolbox/utils/functions';
import { onSoundPlaybackRequested } from 'duo-toolbox/duo/events';

// Setup the detection of sound playback events as soon as possible (challenges are loaded very early).
onSoundPlaybackRequested(noop);

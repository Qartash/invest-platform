import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * A handle on the navigator for code that isn't rendered inside a screen.
 *
 * The guided tour is the reason it exists: its overlay lives beside the navigator, not in it,
 * yet a step has to be able to walk the user to the screen it describes.
 */
export const navigationRef = createNavigationContainerRef();

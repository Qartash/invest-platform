import { CommonActions, StackActions } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

/**
 * What pressing a tab does, shared by {@link BottomDock} and {@link SideRail} so the two
 * bars cannot drift apart.
 *
 * A press always lands on the tab's own first screen — never on whatever screen that tab
 * happened to be left on. The stock behaviour (restore the tab's stack, and do nothing at
 * all when the tab is already selected) leaves the bar unable to rescue anyone: a screen
 * that draws no back button of its own — the notifications list is the one that bit us —
 * becomes a dead end, because the only control on screen is a tab that ignores the press.
 * Reloading does not help either, since the web build restores the same URL.
 *
 * Making the bar an unconditional way home costs the "resume where I was" convenience, and
 * that is the trade we want: four tabs, each one screen deep in practice, and a guaranteed
 * exit is worth more than a remembered position.
 *
 * `popToTop` runs before the jump so the tab is already at its root when it appears, rather
 * than showing the old screen for a frame and then replacing it.
 */
export function pressTab({ state, navigation }: BottomTabBarProps, index: number) {
  const route = state.routes[index];
  const focused = state.index === index;

  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
  if (event.defaultPrevented) return;

  // Absent until the tab has been opened once — an untouched tab is at its root already.
  const stackKey = route.state?.key;
  if (stackKey) {
    navigation.dispatch({ ...StackActions.popToTop(), target: stackKey });
  }

  if (!focused) {
    // Deliberately without `route.params`: a notification opens a tab by dispatching
    // `{ screen, params }` onto it, and those params stay on the route afterwards. Handing
    // them back would re-open the very screen this press is trying to leave.
    navigation.dispatch({
      ...CommonActions.navigate({ name: route.name, merge: true }),
      target: state.key,
    });
  }
}

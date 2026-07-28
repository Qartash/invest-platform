import React, { useEffect, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { registerTarget, TargetRect } from './targets';

interface Props {
  /** Matches `TourStep.target`. Unique across the app. */
  id: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Marks an element as something a tour step can point at.
 *
 * It is a plain `View`, which means it is layout-visible: putting one around a child of a
 * flex row gives that child a wrapper that does not inherit its `flex`. Wrap a block that
 * already sits in its own box, or pass the child's own layout style through `style`.
 *
 * `collapsable={false}` is what keeps the view addressable on Android — without it the
 * renderer is free to flatten a view that draws nothing, and there is then nothing to
 * measure.
 */
export function TourTarget({ id, children, style }: Props) {
  const ref = useRef<View>(null);

  useEffect(
    () =>
      registerTarget(
        id,
        () =>
          new Promise<TargetRect | null>((resolve) => {
            const node = ref.current;
            if (!node) return resolve(null);
            node.measureInWindow((x, y, width, height) => {
              // A zero box means "laid out but not yet painted" — treat it as not ready
              // rather than spotlighting a point.
              if (!width || !height) return resolve(null);
              resolve({ x, y, width, height });
            });
          }),
      ),
    [id],
  );

  return (
    <View ref={ref} style={style} collapsable={false}>
      {children}
    </View>
  );
}

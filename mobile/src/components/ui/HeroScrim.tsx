import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Dark wash laid over a cover image so white text stays legible regardless of what the
 * founder uploaded. Drawn with react-native-svg — the app has no gradient package, and a
 * stack of translucent Views banded visibly across the fade.
 *
 * Deliberately identical in both themes: it sits on photography, not on the app ground.
 */
export function HeroScrim() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="heroScrim" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#0A120C" stopOpacity={0.88} />
          <Stop offset="0.55" stopColor="#0A120C" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#0A120C" stopOpacity={0.05} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroScrim)" />
    </Svg>
  );
}

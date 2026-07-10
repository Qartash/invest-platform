import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type TabIconName = 'projects' | 'myProjects' | 'moderation' | 'profile';

interface Props {
  name: TabIconName;
  color: string;
  size?: number;
  focused?: boolean;
}

// Bottom tab icons drawn in-house on react-native-svg (already bundled in the APK,
// so changes here ship over OTA). Outline when inactive, tinted fill when focused.
export function TabBarIcon({ name, color, size = 24, focused = false }: Props) {
  const fill = focused ? color : 'none';
  const fillOpacity = focused ? 0.18 : 0;
  const strokeWidth = focused ? 2.2 : 1.8;

  switch (name) {
    case 'projects':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M3.5 10.2 12 3.4l8.5 6.8V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1v-9.8Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            fill={fill}
            fillOpacity={fillOpacity}
          />
        </Svg>
      );
    case 'myProjects':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M4.5 8h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            fill={fill}
            fillOpacity={fillOpacity}
          />
          <Path
            d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M3.5 13h17" stroke={color} strokeWidth={strokeWidth} />
        </Svg>
      );
    case 'moderation':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 3.2 19 6v5.2c0 4.4-2.9 7.4-7 8.9-4.1-1.5-7-4.5-7-8.9V6l7-2.8Z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            fill={fill}
            fillOpacity={fillOpacity}
          />
          <Path
            d="m9 11.6 2.2 2.2L15.2 9.6"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle
            cx={12}
            cy={7.5}
            r={3.8}
            stroke={color}
            strokeWidth={strokeWidth}
            fill={fill}
            fillOpacity={fillOpacity}
          />
          <Path
            d="M4.5 20.5c.6-3.6 3.6-5.5 7.5-5.5s6.9 1.9 7.5 5.5"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill={fill}
            fillOpacity={fillOpacity}
          />
        </Svg>
      );
  }
}

import React from 'react';
import Svg, { Circle, Path, Polyline, Rect } from 'react-native-svg';

export type IconName =
  | 'chart'
  | 'checklist'
  | 'history'
  | 'dots'
  | 'chevronDown'
  | 'chevronUp'
  | 'edit'
  | 'trash'
  | 'eye'
  | 'eyeOff'
  | 'tag'
  | 'layers'
  | 'comment'
  | 'plus'
  | 'close'
  | 'check'
  | 'flag'
  | 'shield'
  | 'refresh'
  | 'undo'
  | 'wrench'
  | 'file'
  | 'wallet'
  | 'briefcase'
  | 'trendUp'
  | 'clock'
  | 'users'
  | 'star'
  | 'unlock';

interface Props {
  name: IconName;
  color: string;
  size?: number;
}

// Outline glyphs for card actions, drawn in-house on react-native-svg to match TabBarIcon —
// the app ships no icon font, and adding one for a dozen shapes would cost more than the
// shapes themselves. All paths live on a 24×24 grid with a 1.8 stroke.
export function Icon({ name, color, size = 16 }: Props) {
  const stroke = color;
  const strokeWidth = 1.8;
  const common = {
    stroke,
    strokeWidth,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderPaths(name, common, color)}
    </Svg>
  );
}

function renderPaths(name: IconName, common: any, color: string) {
  switch (name) {
    case 'chart':
      return (
        <>
          <Path d="M4 20h16" {...common} />
          <Rect x="5.5" y="11" width="3.6" height="6" rx="1" {...common} />
          <Rect x="10.2" y="7" width="3.6" height="10" rx="1" {...common} />
          <Rect x="14.9" y="13" width="3.6" height="4" rx="1" {...common} />
        </>
      );
    case 'checklist':
      return (
        <>
          <Polyline points="3.5,7 5,8.5 7.5,5.5" {...common} />
          <Polyline points="3.5,17 5,18.5 7.5,15.5" {...common} />
          <Path d="M11 7h9.5M11 17h9.5" {...common} />
        </>
      );
    case 'history':
      return (
        <>
          <Path d="M3.8 12a8.2 8.2 0 1 0 2.6-6" {...common} />
          <Polyline points="3.5,3.2 3.5,7 7.3,7" {...common} />
          <Polyline points="12,7.6 12,12 15.2,13.8" {...common} />
        </>
      );
    case 'dots':
      return (
        <>
          <Circle cx="5.5" cy="12" r="1.7" fill={color} />
          <Circle cx="12" cy="12" r="1.7" fill={color} />
          <Circle cx="18.5" cy="12" r="1.7" fill={color} />
        </>
      );
    case 'chevronDown':
      return <Polyline points="6,9.5 12,15.5 18,9.5" {...common} />;
    case 'chevronUp':
      return <Polyline points="6,14.5 12,8.5 18,14.5" {...common} />;
    case 'edit':
      return (
        <>
          <Path d="M4 20h4.2l9.6-9.6a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8V20Z" {...common} />
          <Path d="M14.2 6.6 17.4 9.8" {...common} />
        </>
      );
    case 'trash':
      return (
        <>
          <Path d="M4.5 6.5h15" {...common} />
          <Path d="M9.5 6.5V4.8a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.7" {...common} />
          <Path d="M6.5 6.5 7.4 19a1.2 1.2 0 0 0 1.2 1.1h6.8a1.2 1.2 0 0 0 1.2-1.1l.9-12.5" {...common} />
          <Path d="M10.4 10v6M13.6 10v6" {...common} />
        </>
      );
    case 'eye':
      return (
        <>
          <Path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" {...common} />
          <Circle cx="12" cy="12" r="2.9" {...common} />
        </>
      );
    case 'eyeOff':
      return (
        <>
          <Path d="M9.9 5.9A8.9 8.9 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a16.4 16.4 0 0 1-3.2 3.9" {...common} />
          <Path d="M6.5 7.9A16.2 16.2 0 0 0 2.5 12S6 18.2 12 18.2a9.3 9.3 0 0 0 3.9-.8" {...common} />
          <Path d="M9.9 9.9a2.9 2.9 0 0 0 4.1 4.1" {...common} />
          <Path d="M3.5 3.5 20.5 20.5" {...common} />
        </>
      );
    case 'tag':
      return (
        <>
          <Path
            d="M11.3 3.5H20a.5.5 0 0 1 .5.5v8.7a1 1 0 0 1-.3.7l-7.3 7.3a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1 0-1.4l7.1-7.5a1 1 0 0 1 .7-.3Z"
            {...common}
          />
          <Circle cx="16" cy="8" r="1.5" {...common} />
        </>
      );
    case 'layers':
      return (
        <>
          <Path d="M12 3.4 21 8l-9 4.6L3 8l9-4.6Z" {...common} />
          <Polyline points="3,12.6 12,17.2 21,12.6" {...common} />
          <Polyline points="3,16.8 12,21.4 21,16.8" {...common} />
        </>
      );
    case 'comment':
      return <Path d="M20.5 12.4a7.6 7.6 0 0 1-8.2 7.5L5 21l1.3-4.6a7.6 7.6 0 1 1 14.2-4Z" {...common} />;
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...common} />;
    case 'close':
      return <Path d="M6 6l12 12M18 6 6 18" {...common} />;
    case 'check':
      return <Polyline points="4.5,12.5 9.5,17.5 19.5,6.5" {...common} />;
    case 'flag':
      return (
        <>
          <Path d="M5.5 21V4" {...common} />
          <Path d="M5.5 4.6h11.8l-2.1 4 2.1 4H5.5" {...common} />
        </>
      );
    case 'shield':
      return (
        <>
          <Path d="M12 3.2 19.5 6v5.6c0 4-3.1 7.4-7.5 9.2-4.4-1.8-7.5-5.2-7.5-9.2V6L12 3.2Z" {...common} />
          <Polyline points="9,11.8 11.3,14 15,9.8" {...common} />
        </>
      );
    case 'refresh':
      return (
        <>
          <Path d="M20 12a8 8 0 1 1-2.5-5.8" {...common} />
          <Polyline points="20.4,3.6 20.4,7.4 16.6,7.4" {...common} />
        </>
      );
    case 'undo':
      return (
        <>
          <Path d="M4.5 9.5h10.2a4.8 4.8 0 0 1 0 9.6H8.2" {...common} />
          <Polyline points="8.3,5.2 4.2,9.5 8.3,13.8" {...common} />
        </>
      );
    case 'wrench':
      return (
        <Path
          d="M20 5.4 16.8 8.6l-1.4-1.4L18.6 4a5 5 0 0 0-6.4 6.2l-7 7a1.6 1.6 0 0 0 2.3 2.3l7-7A5 5 0 0 0 20 5.4Z"
          {...common}
        />
      );
    case 'file':
      return (
        <>
          <Path d="M13.5 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5l-5-5Z" {...common} />
          <Polyline points="13.4,3.6 13.4,8.6 18.4,8.6" {...common} />
        </>
      );
    case 'wallet':
      return (
        <>
          <Path d="M3.5 7.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-10Z" {...common} />
          <Path d="M18.5 10h2a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-2" {...common} />
          <Circle cx="17.6" cy="12" r="0.9" fill={color} />
        </>
      );
    case 'briefcase':
      return (
        <>
          <Rect x="3" y="7.5" width="18" height="12.5" rx="2" {...common} />
          <Path d="M9 7.5V5.8a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.8v1.7" {...common} />
          <Path d="M3 12.5h18" {...common} />
        </>
      );
    case 'trendUp':
      return (
        <>
          <Polyline points="3.5,16.5 9,10.5 13,14 20.5,6.5" {...common} />
          <Polyline points="15.5,6.5 20.5,6.5 20.5,11.5" {...common} />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle cx="12" cy="12" r="8.5" {...common} />
          <Polyline points="12,6.8 12,12 15.6,13.9" {...common} />
        </>
      );
    case 'users':
      return (
        <>
          <Circle cx="9.2" cy="8.6" r="3.4" {...common} />
          <Path d="M2.8 19.5a6.4 6.4 0 0 1 12.8 0" {...common} />
          <Path d="M16.2 5.6a3.4 3.4 0 0 1 0 6" {...common} />
          <Path d="M17.6 13.6a6.4 6.4 0 0 1 3.6 5.9" {...common} />
        </>
      );
    case 'unlock':
      return (
        <>
          <Rect x="4.5" y="10.5" width="15" height="9.5" rx="2" {...common} />
          <Path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.4-1.3" {...common} />
        </>
      );
    // Partners: the one tab about singling someone out rather than about a queue
    // of work, which is why it is a star and not another document shape.
    case 'star':
      return <Path d="M12 3.6l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 10l6-.8L12 3.6Z" {...common} />;
    default:
      return null;
  }
}

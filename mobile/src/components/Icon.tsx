import Svg, { Path } from 'react-native-svg';

import { useIsRTL } from '@/i18n';

export type IconName = 'paste' | 'back' | 'share' | 'gear' | 'close' | 'sound' | 'mute' | 'crown' | 'check' | 'exit' | 'shuffle';

// Stroke icons on a 24×24 grid. Only directional ones (back, exit) mirror in Arabic.
const PATHS: Record<IconName, string[]> = {
  back: ['M15 5l-7 7 7 7'],
  paste: ['M9 4h6v3H9z', 'M15 5h2a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h2'],
  share: ['M12 15V3', 'M7 8l5-5 5 5', 'M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6'],
  gear: [
    'M12 15a3 3 0 100-6 3 3 0 000 6z',
    'M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  ],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  sound: ['M11 5L6 9H3v6h3l5 4V5z', 'M15.5 8.5a5 5 0 010 7', 'M18.5 5.5a9 9 0 010 13'],
  mute: ['M11 5L6 9H3v6h3l5 4V5z', 'M22 9l-6 6', 'M16 9l6 6'],
  crown: ['M3 18h18', 'M4 15l-1-9 5 4 4-6 4 6 5-4-1 9H4z'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  exit: ['M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3', 'M10 17l-5-5 5-5', 'M5 12h11'],
  shuffle: ['M16 3h5v5', 'M4 20L21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
};

const MIRRORED: IconName[] = ['back', 'exit'];

type Props = { name: IconName; size?: number; color: string; strokeWidth?: number };

export function Icon({ name, size = 24, color, strokeWidth = 2.4 }: Props) {
  const rtl = useIsRTL();
  const flip = rtl && MIRRORED.includes(name);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      {PATHS[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

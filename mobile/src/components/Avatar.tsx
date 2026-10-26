import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import { type AvatarDef, avatarDef, type Body, type Eyes, type Mouth, type Top } from '@/game/avatars';

const INK = '#1B1035';
const PINK = '#FB7185';

type Props = { avatar: number; size?: number; dimmed?: boolean; ring?: boolean; ringColor?: string };

/** One of the 24 characters, drawn as SVG inside its color ring. */
export const Avatar = memo(function Avatar({ avatar, size = 48, dimmed, ring = true, ringColor }: Props) {
  const def = avatarDef(avatar);
  const border = ring ? Math.max(2, Math.round(size * 0.07)) : 0;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: border,
        borderColor: ringColor ?? def.ring,
        backgroundColor: def.bg,
        overflow: 'hidden',
        opacity: dimmed ? 0.35 : 1,
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Character def={def} />
      </Svg>
    </View>
  );
});

// Where each body's head starts (its top edge) and where the eyes sit, in the 100×100 box.
const ANCHORS: Record<Body, { top: number; eyeY: number }> = {
  round: { top: 30, eyeY: 58 },
  bean: { top: 24, eyeY: 50 },
  ghost: { top: 26, eyeY: 54 },
  square: { top: 32, eyeY: 58 },
  pear: { top: 28, eyeY: 58 },
};

const BEHIND: Top[] = ['catEars', 'bearEars', 'antenna', 'horns', 'bunny', 'mohawk'];

function Character({ def }: { def: AvatarDef }) {
  const { top, eyeY } = ANCHORS[def.body];
  const behind = BEHIND.includes(def.top);
  return (
    <G>
      {behind ? <Headwear def={def} top={top} /> : null}
      <BodyShape body={def.body} color={def.color} />
      {def.belly ? <Ellipse cx={50} cy={eyeY + 36} rx={20} ry={16} fill="#FFFFFF" opacity={0.35} /> : null}
      {def.cheeks ? (
        <G opacity={0.55}>
          <Circle cx={30} cy={eyeY + 10} r={5} fill={PINK} />
          <Circle cx={70} cy={eyeY + 10} r={5} fill={PINK} />
        </G>
      ) : null}
      <EyesShape eyes={def.eyes} y={eyeY} />
      <MouthShape mouth={def.mouth} y={eyeY + 15} />
      {!behind ? <Headwear def={def} top={top} /> : null}
    </G>
  );
}

function BodyShape({ body, color }: { body: Body; color: string }) {
  switch (body) {
    case 'round':
      return <Circle cx={50} cy={66} r={36} fill={color} />;
    case 'bean':
      return <Rect x={20} y={24} width={60} height={90} rx={30} fill={color} />;
    case 'ghost':
      return (
        <Path
          d="M18 100 V56 a32 32 0 0 1 64 0 V100 l-10.7 -9 l-10.7 9 l-10.6 -9 l-10.7 9 l-10.6 -9 Z"
          fill={color}
        />
      );
    case 'square':
      return <Rect x={18} y={32} width={64} height={80} rx={18} fill={color} />;
    case 'pear':
      return <Path d="M50 28 C68 28 70 46 77 62 C86 84 78 112 50 112 C22 112 14 84 23 62 C30 46 32 28 50 28 Z" fill={color} />;
  }
}

function Pupil({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={INK} />
      <Circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill="#FFFFFF" />
    </G>
  );
}

function EyesShape({ eyes, y }: { eyes: Eyes; y: number }) {
  const l = 39;
  const r = 61;
  switch (eyes) {
    case 'dots':
      return (
        <G>
          <Pupil x={l} y={y} r={5.5} />
          <Pupil x={r} y={y} r={5.5} />
        </G>
      );
    case 'big':
      return (
        <G>
          <Circle cx={l} cy={y} r={9} fill="#FFFFFF" />
          <Circle cx={r} cy={y} r={9} fill="#FFFFFF" />
          <Pupil x={l + 1.5} y={y + 1} r={5} />
          <Pupil x={r + 1.5} y={y + 1} r={5} />
        </G>
      );
    case 'cyclops':
      return (
        <G>
          <Circle cx={50} cy={y - 2} r={13} fill="#FFFFFF" />
          <Pupil x={51} y={y - 1} r={7} />
        </G>
      );
    case 'sleepy':
      return (
        <G>
          <Path d={`M${l - 6} ${y} Q${l} ${y + 6} ${l + 6} ${y}`} stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <Path d={`M${r - 6} ${y} Q${r} ${y + 6} ${r + 6} ${y}`} stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
        </G>
      );
    case 'glasses':
      return (
        <G>
          <Circle cx={l} cy={y} r={9.5} fill="#FFFFFF" opacity={0.5} stroke={INK} strokeWidth={3} />
          <Circle cx={r} cy={y} r={9.5} fill="#FFFFFF" opacity={0.5} stroke={INK} strokeWidth={3} />
          <Line x1={l + 9.5} y1={y} x2={r - 9.5} y2={y} stroke={INK} strokeWidth={3} />
          <Pupil x={l} y={y} r={4} />
          <Pupil x={r} y={y} r={4} />
        </G>
      );
    case 'shades':
      return (
        <G>
          <Path
            d={`M${l - 11} ${y - 6} H${r + 11} V${y - 2} Q${r + 10} ${y + 8} ${r} ${y + 7} Q${r - 9} ${y + 7} ${r - 10} ${y - 1} H${l + 10} Q${l + 9} ${y + 7} ${l} ${y + 7} Q${l - 10} ${y + 8} ${l - 11} ${y - 2} Z`}
            fill={INK}
          />
          <Line x1={l - 5} y1={y - 2} x2={l + 1} y2={y - 2} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
          <Line x1={r - 5} y1={y - 2} x2={r + 1} y2={y - 2} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        </G>
      );
    case 'angry':
      return (
        <G>
          <Pupil x={l} y={y + 1} r={5} />
          <Pupil x={r} y={y + 1} r={5} />
          <Line x1={l - 8} y1={y - 10} x2={l + 6} y2={y - 5} stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
          <Line x1={r + 8} y1={y - 10} x2={r - 6} y2={y - 5} stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
        </G>
      );
    case 'wink':
      return (
        <G>
          <Pupil x={l} y={y} r={5.5} />
          <Path d={`M${r - 6} ${y + 1} Q${r} ${y - 5} ${r + 6} ${y + 1}`} stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />
        </G>
      );
  }
}

function MouthShape({ mouth, y }: { mouth: Mouth; y: number }) {
  const smile = `M41 ${y} Q50 ${y + 9} 59 ${y}`;
  const stroke = { stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' as const, fill: 'none' };
  switch (mouth) {
    case 'smile':
      return <Path d={smile} {...stroke} />;
    case 'grin':
      return (
        <G>
          <Path d={`M38 ${y - 2} Q50 ${y + 16} 62 ${y - 2} Z`} fill={INK} />
          <Ellipse cx={50} cy={y + 6} rx={5} ry={3} fill={PINK} />
        </G>
      );
    case 'o':
      return <Ellipse cx={50} cy={y + 2} rx={4.5} ry={5.5} fill={INK} />;
    case 'cat':
      return <Path d={`M41 ${y} Q45.5 ${y + 6} 50 ${y} Q54.5 ${y + 6} 59 ${y}`} {...stroke} />;
    case 'tongue':
      return (
        <G>
          <Ellipse cx={53} cy={y + 6} rx={4.5} ry={5} fill={PINK} />
          <Path d={smile} {...stroke} />
        </G>
      );
    case 'fang':
      return (
        <G>
          <Path d={smile} {...stroke} />
          <Path d={`M52 ${y + 3.5} l5 -1.2 l-1.8 5.5 Z`} fill="#FFFFFF" />
        </G>
      );
    case 'flat':
      return <Line x1={43} y1={y + 2} x2={57} y2={y + 2} {...stroke} />;
    case 'teeth':
      return (
        <G>
          <Rect x={45.5} y={y + 2} width={9} height={6} rx={1.5} fill="#FFFFFF" stroke={INK} strokeWidth={1.5} />
          <Path d={smile} {...stroke} />
        </G>
      );
  }
}

function Headwear({ def, top }: { def: AvatarDef; top: number }) {
  const { color, accent } = def;
  const t = top;
  switch (def.top) {
    case 'none':
      return null;
    case 'catEars':
      return (
        <G>
          <Path d={`M24 ${t + 18} L28 ${t - 10} L46 ${t + 4} Z`} fill={color} />
          <Path d={`M76 ${t + 18} L72 ${t - 10} L54 ${t + 4} Z`} fill={color} />
          <Path d={`M29 ${t + 10} L30.5 ${t - 2} L39 ${t + 4} Z`} fill={PINK} opacity={0.7} />
          <Path d={`M71 ${t + 10} L69.5 ${t - 2} L61 ${t + 4} Z`} fill={PINK} opacity={0.7} />
        </G>
      );
    case 'bearEars':
      return (
        <G>
          <Circle cx={27} cy={t + 6} r={11} fill={color} />
          <Circle cx={73} cy={t + 6} r={11} fill={color} />
          <Circle cx={27} cy={t + 6} r={5.5} fill={accent} />
          <Circle cx={73} cy={t + 6} r={5.5} fill={accent} />
        </G>
      );
    case 'antenna':
      return (
        <G>
          <Line x1={50} y1={t + 4} x2={50} y2={t - 14} stroke={INK} strokeWidth={3} />
          <Circle cx={50} cy={t - 16} r={6} fill={accent} stroke={INK} strokeWidth={2} />
        </G>
      );
    case 'horns':
      return (
        <G>
          <Path d={`M30 ${t + 12} Q20 ${t - 6} 30 ${t - 14} Q31 ${t - 2} 42 ${t + 6} Z`} fill={accent} />
          <Path d={`M70 ${t + 12} Q80 ${t - 6} 70 ${t - 14} Q69 ${t - 2} 58 ${t + 6} Z`} fill={accent} />
        </G>
      );
    case 'bunny':
      return (
        <G>
          <Ellipse cx={37} cy={t - 10} rx={8} ry={22} fill={color} transform={`rotate(-12 37 ${t - 10})`} />
          <Ellipse cx={63} cy={t - 10} rx={8} ry={22} fill={color} transform={`rotate(12 63 ${t - 10})`} />
          <Ellipse cx={37} cy={t - 10} rx={4} ry={15} fill={accent} transform={`rotate(-12 37 ${t - 10})`} />
          <Ellipse cx={63} cy={t - 10} rx={4} ry={15} fill={accent} transform={`rotate(12 63 ${t - 10})`} />
        </G>
      );
    case 'crown':
      return (
        <G>
          <Path d={`M32 ${t + 4} L32 ${t - 14} L41 ${t - 5} L50 ${t - 18} L59 ${t - 5} L68 ${t - 14} L68 ${t + 4} Z`} fill={accent} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <Circle cx={50} cy={t - 3} r={3} fill="#F43F5E" />
        </G>
      );
    case 'partyHat':
      return (
        <G>
          <Path d={`M37 ${t + 6} L50 ${t - 24} L63 ${t + 6} Z`} fill={accent} />
          <Path d={`M41.5 ${t - 4} L58.5 ${t - 4}`} stroke="#FFFFFF" strokeWidth={3} />
          <Path d={`M45.5 ${t - 14} L54.5 ${t - 14}`} stroke="#FFFFFF" strokeWidth={3} />
          <Circle cx={50} cy={t - 25} r={5} fill="#FFFFFF" />
        </G>
      );
    case 'sprout':
      return (
        <G>
          <Path d={`M50 ${t + 4} Q49 ${t - 6} 50 ${t - 12}`} stroke={accent} strokeWidth={3} fill="none" />
          <Path d={`M50 ${t - 10} Q38 ${t - 22} 34 ${t - 10} Q42 ${t - 4} 50 ${t - 10} Z`} fill="#22C55E" />
          <Path d={`M50 ${t - 12} Q62 ${t - 26} 67 ${t - 13} Q58 ${t - 6} 50 ${t - 12} Z`} fill="#16A34A" />
        </G>
      );
    case 'cap':
      return (
        <G>
          <Path d={`M28 ${t + 12} Q28 ${t - 10} 50 ${t - 10} Q72 ${t - 10} 72 ${t + 12} Z`} fill={accent} />
          <Rect x={50} y={t + 7} width={34} height={7} rx={3.5} fill={accent} />
          <Circle cx={50} cy={t - 10} r={3} fill="#FFFFFF" />
        </G>
      );
    case 'bow':
      return (
        <G>
          <Path d={`M62 ${t + 6} L50 ${t - 4} L50 ${t + 16} Z`} fill={accent} />
          <Path d={`M62 ${t + 6} L74 ${t - 4} L74 ${t + 16} Z`} fill={accent} />
          <Circle cx={62} cy={t + 6} r={4} fill={accent} stroke={INK} strokeWidth={1.5} />
        </G>
      );
    case 'mohawk':
      return (
        <Path
          d={`M38 ${t + 8} L36 ${t - 8} L43 ${t - 1} L45 ${t - 16} L50 ${t - 4} L55 ${t - 16} L57 ${t - 1} L64 ${t - 8} L62 ${t + 8} Z`}
          fill={accent}
        />
      );
    case 'halo':
      return <Ellipse cx={50} cy={t - 9} rx={17} ry={5} fill="none" stroke={accent} strokeWidth={4} />;
    case 'beanie':
      return (
        <G>
          <Path d={`M27 ${t + 14} Q27 ${t - 10} 50 ${t - 10} Q73 ${t - 10} 73 ${t + 14} Z`} fill="#F43F5E" />
          <Rect x={25} y={t + 8} width={50} height={9} rx={4.5} fill={accent} />
          <Circle cx={50} cy={t - 12} r={6} fill={accent} />
        </G>
      );
    case 'tuft':
      return (
        <Path
          d={`M44 ${t + 3} Q42 ${t - 10} 52 ${t - 12} Q47 ${t - 4} 56 ${t + 2}`}
          stroke={def.accent}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}

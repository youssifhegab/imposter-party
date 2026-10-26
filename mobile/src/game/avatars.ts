// The 24 built-in characters. The index is what the server stores (0–23); changing the order changes
// everyone's avatar, so only append or edit in place. Drawn by components/Avatar.tsx.

export type Body = 'round' | 'bean' | 'ghost' | 'square' | 'pear';
export type Eyes = 'dots' | 'big' | 'cyclops' | 'sleepy' | 'glasses' | 'shades' | 'angry' | 'wink';
export type Mouth = 'smile' | 'grin' | 'o' | 'cat' | 'tongue' | 'fang' | 'flat' | 'teeth';
export type Top =
  | 'none'
  | 'catEars'
  | 'bearEars'
  | 'antenna'
  | 'horns'
  | 'bunny'
  | 'crown'
  | 'partyHat'
  | 'sprout'
  | 'cap'
  | 'bow'
  | 'mohawk'
  | 'halo'
  | 'beanie'
  | 'tuft';

export type AvatarDef = {
  body: Body;
  color: string;
  /** Hats, horns and ears. */
  accent: string;
  bg: string;
  /** The ring drawn around this avatar everywhere it appears. */
  ring: string;
  eyes: Eyes;
  mouth: Mouth;
  top: Top;
  cheeks?: boolean;
  belly?: boolean;
};

export const AVATARS: AvatarDef[] = [
  { body: 'round', color: '#FB923C', accent: '#FDBA74', bg: '#FFEDD5', ring: '#F97316', eyes: 'dots', mouth: 'cat', top: 'catEars', cheeks: true },
  { body: 'bean', color: '#60A5FA', accent: '#FACC15', bg: '#DBEAFE', ring: '#3B82F6', eyes: 'big', mouth: 'smile', top: 'antenna' },
  { body: 'ghost', color: '#F5F3FF', accent: '#A78BFA', bg: '#C4B5FD', ring: '#8B5CF6', eyes: 'dots', mouth: 'o', top: 'none', cheeks: true },
  { body: 'round', color: '#34D399', accent: '#065F46', bg: '#D1FAE5', ring: '#10B981', eyes: 'cyclops', mouth: 'grin', top: 'sprout' },
  { body: 'square', color: '#F87171', accent: '#FDE68A', bg: '#FEE2E2', ring: '#EF4444', eyes: 'angry', mouth: 'fang', top: 'horns' },
  { body: 'pear', color: '#A78BFA', accent: '#FACC15', bg: '#EDE9FE', ring: '#7C3AED', eyes: 'wink', mouth: 'tongue', top: 'crown', cheeks: true },
  { body: 'round', color: '#A16207', accent: '#713F12', bg: '#FEF3C7', ring: '#CA8A04', eyes: 'dots', mouth: 'smile', top: 'bearEars', belly: true },
  { body: 'bean', color: '#F9A8D4', accent: '#F472B6', bg: '#FCE7F3', ring: '#EC4899', eyes: 'big', mouth: 'teeth', top: 'bunny', cheeks: true },
  { body: 'square', color: '#94A3B8', accent: '#22D3EE', bg: '#E2E8F0', ring: '#64748B', eyes: 'shades', mouth: 'flat', top: 'antenna' },
  { body: 'round', color: '#FACC15', accent: '#F43F5E', bg: '#FEF9C3', ring: '#EAB308', eyes: 'big', mouth: 'grin', top: 'partyHat', cheeks: true },
  { body: 'pear', color: '#2DD4BF', accent: '#F43F5E', bg: '#CCFBF1', ring: '#14B8A6', eyes: 'glasses', mouth: 'smile', top: 'cap' },
  { body: 'ghost', color: '#86EFAC', accent: '#FACC15', bg: '#14532D', ring: '#22C55E', eyes: 'big', mouth: 'fang', top: 'halo' },
  { body: 'bean', color: '#F472B6', accent: '#FDE047', bg: '#FCE7F3', ring: '#DB2777', eyes: 'dots', mouth: 'o', top: 'bow', cheeks: true },
  { body: 'round', color: '#4ADE80', accent: '#16A34A', bg: '#DCFCE7', ring: '#22C55E', eyes: 'sleepy', mouth: 'smile', top: 'tuft', belly: true },
  { body: 'square', color: '#818CF8', accent: '#F472B6', bg: '#E0E7FF', ring: '#6366F1', eyes: 'dots', mouth: 'grin', top: 'mohawk' },
  { body: 'pear', color: '#FDBA74', accent: '#7C2D12', bg: '#FFEDD5', ring: '#EA580C', eyes: 'sleepy', mouth: 'cat', top: 'catEars', cheeks: true },
  { body: 'round', color: '#38BDF8', accent: '#F8FAFC', bg: '#E0F2FE', ring: '#0284C7', eyes: 'wink', mouth: 'tongue', top: 'beanie' },
  { body: 'bean', color: '#E879F9', accent: '#FDE68A', bg: '#FAE8FF', ring: '#C026D3', eyes: 'cyclops', mouth: 'teeth', top: 'horns' },
  { body: 'ghost', color: '#FDE68A', accent: '#F59E0B', bg: '#FEF3C7', ring: '#D97706', eyes: 'sleepy', mouth: 'o', top: 'none', cheeks: true },
  { body: 'square', color: '#FB7185', accent: '#1E293B', bg: '#FFE4E6', ring: '#E11D48', eyes: 'glasses', mouth: 'smile', top: 'tuft' },
  { body: 'round', color: '#A3E635', accent: '#4D7C0F', bg: '#ECFCCB', ring: '#65A30D', eyes: 'big', mouth: 'o', top: 'antenna', cheeks: true },
  { body: 'pear', color: '#CBD5E1', accent: '#F43F5E', bg: '#F1F5F9', ring: '#94A3B8', eyes: 'shades', mouth: 'fang', top: 'mohawk' },
  { body: 'bean', color: '#FCA5A5', accent: '#B91C1C', bg: '#FEE2E2', ring: '#DC2626', eyes: 'angry', mouth: 'flat', top: 'cap' },
  { body: 'round', color: '#C084FC', accent: '#F9A8D4', bg: '#F3E8FF', ring: '#9333EA', eyes: 'dots', mouth: 'grin', top: 'bunny', belly: true },
];

export const avatarDef = (index: number): AvatarDef => AVATARS[index] ?? AVATARS[0];
export const avatarRing = (index: number) => avatarDef(index).ring;

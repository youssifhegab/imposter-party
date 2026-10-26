import type { ReactNode } from 'react';

import { Screen } from '@/components/Screen';
import { useGame } from '@/game/useGame';
import { phaseColors } from '@/theme';

import { ErrorBanner } from './ErrorBanner';
import { RoomHeader } from './RoomHeader';
import { useLeaveRoom } from './useLeaveRoom';

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  flood?: boolean;
  fixed?: boolean;
  overlay?: ReactNode;
  /** Overrides the phase color, e.g. red for the imposter's last chance. */
  accent?: string;
};

/** A Screen in the phase color, with the room header and error banner on top. */
export function RoomScreen({ children, footer, flood, fixed, overlay, accent }: Props) {
  const { state } = useGame();
  const leaveRoom = useLeaveRoom();
  return (
    <Screen
      accent={accent ?? phaseColors[state.phase]}
      flood={flood}
      fixed={fixed}
      overlay={overlay}
      footer={footer}
      header={
        <>
          <RoomHeader onLeave={leaveRoom} />
          <ErrorBanner />
        </>
      }
    >
      {children}
    </Screen>
  );
}

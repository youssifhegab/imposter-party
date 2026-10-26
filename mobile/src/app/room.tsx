import { useEffect } from 'react';

import { ConnectingView } from '@/features/room/ConnectingView';
import { EndedView } from '@/features/room/EndedView';
import { PhaseView } from '@/features/room/PhaseView';
import { goHome } from '@/features/room/useLeaveRoom';
import { connect, disconnect } from '@/net/gameSocket';
import { useRoomStore } from '@/state/room';
import { useSession } from '@/state/session';

export default function Room() {
  const creds = useSession((s) => s.creds);
  const setCreds = useSession((s) => s.setCreds);
  const hasState = useRoomStore((s) => s.state !== null);
  const ended = useRoomStore((s) => s.ended);

  // The socket lives as long as this screen. Going back home closes it; the seat is held for 60s.
  useEffect(() => {
    if (!creds) return;
    connect(creds);
    return () => disconnect();
  }, [creds]);

  // Only reached for a moment while leaving: creds are cleared, then the screen is popped.
  if (!creds) return null;
  if (ended) {
    return (
      <EndedView
        reason={ended}
        onHome={() => {
          setCreds(null);
          goHome();
        }}
      />
    );
  }
  if (!hasState) return <ConnectingView onCancel={goHome} />;
  return <PhaseView />;
}

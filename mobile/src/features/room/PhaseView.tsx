import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useGame } from '@/game/useGame';

import { CluesView } from './CluesView';
import { DiscussionView } from './DiscussionView';
import { FinalView } from './FinalView';
import { GuessView } from './GuessView';
import { LobbyView } from './LobbyView';
import { ResultsView } from './ResultsView';
import { RevealView } from './RevealView';
import { VotingView } from './VotingView';
import { WaitingView } from './WaitingView';

/**
 * The server's phase decides the screen. The key changes with the phase and round, which resets local
 * state (like a vote selection) and fades the new screen in.
 */
export function PhaseView() {
  const { state, me } = useGame();
  const key = `${state.phase}-${state.round?.number ?? 0}`;
  return (
    <View style={{ flex: 1 }}>
      <Animated.View key={key} entering={FadeIn.duration(250)} style={{ flex: 1 }}>
        {me?.waiting && state.phase !== 'LOBBY' ? <WaitingView /> : <Phase />}
      </Animated.View>
    </View>
  );
}

function Phase() {
  const { state } = useGame();
  switch (state.phase) {
    case 'LOBBY':
      return <LobbyView />;
    case 'REVEAL':
      return <RevealView />;
    case 'CLUES':
      return <CluesView />;
    case 'DISCUSSION':
      return <DiscussionView />;
    case 'VOTING':
    case 'REVOTE':
      return <VotingView />;
    case 'GUESS':
      return <GuessView />;
    case 'RESULTS':
      return <ResultsView />;
    case 'FINAL':
      return <FinalView />;
  }
}

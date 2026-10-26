package com.imposter.engine

object Awards {
    /** Folds one finished round into each seated player's running game stats. */
    fun updateStats(stats: Map<String, PlayerStats>, round: Round, playerIds: List<String>): Map<String, PlayerStats> {
        val received = round.votes.values.flatten().groupingBy { it }.eachCount()
        return stats + playerIds.associateWith { id ->
            val current = stats[id] ?: PlayerStats()
            val clueTimes = round.clues.filter { it.playerId == id }.mapNotNull { it.durationMs }
            val withClues = current.copy(
                clueCount = current.clueCount + clueTimes.size,
                clueMsTotal = current.clueMsTotal + clueTimes.sum(),
            )
            if (id in round.imposterIds) {
                withClues.copy(
                    survivedAsImposter = withClues.survivedAsImposter + if (id in round.caughtIds) 0 else 1,
                    correctGuesses = withClues.correctGuesses + if (round.guesses[id]?.correct == true) 1 else 0,
                )
            } else {
                // Correct votes and suspicion use the first vote; the revote only settles a tie.
                val hits = round.votes[id].orEmpty().count { it in round.imposterIds }
                val streak = if (hits > 0) withClues.catchStreak + 1 else 0
                withClues.copy(
                    correctVotes = withClues.correctVotes + hits,
                    votesReceivedAsCrew = withClues.votesReceivedAsCrew + (received[id] ?: 0),
                    catchStreak = streak,
                    bestCatchStreak = maxOf(withClues.bestCatchStreak, streak),
                )
            }
        }
    }

    fun compute(stats: Map<String, PlayerStats>): List<Award> = listOfNotNull(
        most(AwardType.MASTER_OF_DISGUISE, stats) { it.survivedAsImposter.toLong() },
        most(AwardType.DETECTIVE, stats) { it.correctVotes.toLong() },
        most(AwardType.MOST_SUSPICIOUS, stats) { it.votesReceivedAsCrew.toLong() },
        most(AwardType.MIND_READER, stats) { it.correctGuesses.toLong() },
        fastestClue(stats),
    )

    private fun most(type: AwardType, stats: Map<String, PlayerStats>, metric: (PlayerStats) -> Long): Award? {
        val best = stats.values.maxOfOrNull(metric) ?: return null
        if (best <= 0) return null
        return Award(type, stats.filterValues { metric(it) == best }.keys.toList(), best)
    }

    private fun fastestClue(stats: Map<String, PlayerStats>): Award? {
        val averages = stats.filterValues { it.clueCount > 0 }.mapValues { it.value.clueMsTotal / it.value.clueCount }
        val best = averages.values.minOrNull() ?: return null
        return Award(AwardType.SPEED_DEMON, averages.filterValues { it == best }.keys.toList(), best)
    }
}

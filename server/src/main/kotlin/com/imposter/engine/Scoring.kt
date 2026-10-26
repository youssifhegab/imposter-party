package com.imposter.engine

object Scoring {
    const val CREW_PER_CAUGHT_IMPOSTER = 1
    const val IMPOSTER_SURVIVED = 2
    const val IMPOSTER_CAUGHT_GUESSED = 1
    const val IMPOSTER_CAUGHT_WRONG = 0

    fun roundPoints(round: Round, playerIds: List<String>): Map<String, Int> {
        val caughtImposters = round.caughtImposterIds.size
        return playerIds.associateWith { id ->
            when {
                id !in round.imposterIds -> caughtImposters * CREW_PER_CAUGHT_IMPOSTER
                id !in round.caughtIds -> IMPOSTER_SURVIVED
                round.guesses[id]?.correct == true -> IMPOSTER_CAUGHT_GUESSED
                else -> IMPOSTER_CAUGHT_WRONG
            }
        }
    }

    /** Highest score first. Equal scores share a rank (1, 1, 3). */
    fun leaderboard(scores: Map<String, Int>): List<LeaderboardEntry> {
        val sorted = scores.entries.sortedByDescending { it.value }
        return sorted.map { entry ->
            LeaderboardEntry(entry.key, entry.value, rank = 1 + sorted.count { it.value > entry.value })
        }
    }
}

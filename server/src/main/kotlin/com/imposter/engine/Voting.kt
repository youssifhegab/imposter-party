package com.imposter.engine

sealed interface Tally {
    data class Decided(val ids: Set<String>) : Tally

    /** [locked] are clearly in; [tied] share the cutoff and compete for the remaining [slots]. */
    data class Tie(val locked: Set<String>, val tied: Set<String>, val slots: Int) : Tally
}

object Voting {
    /**
     * Finds who fills the top [slots] by vote count. Players with zero votes are never caught.
     * A tie only matters when it straddles the cutoff: e.g. with 2 slots, A=2 B=2 C=1 is decided (A, B),
     * but A=3 B=2 C=2 is a tie between B and C for one slot.
     */
    fun tally(votes: Map<String, List<String>>, slots: Int): Tally {
        val ranked = votes.values.flatten()
            .groupingBy { it }
            .eachCount()
            .entries
            .sortedByDescending { it.value }
        if (slots <= 0) return Tally.Decided(emptySet())
        if (ranked.size <= slots) return Tally.Decided(ranked.map { it.key }.toSet())

        val cutoff = ranked[slots - 1].value
        if (ranked[slots].value < cutoff) return Tally.Decided(ranked.take(slots).map { it.key }.toSet())

        val locked = ranked.filter { it.value > cutoff }.map { it.key }.toSet()
        val tied = ranked.filter { it.value == cutoff }.map { it.key }.toSet()
        return Tally.Tie(locked, tied, slots - locked.size)
    }
}

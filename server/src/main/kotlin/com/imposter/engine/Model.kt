package com.imposter.engine

// The whole game state is immutable data classes. The engine never mutates a Room; it returns a new one
// built with copy(...). That makes every transition easy to test and impossible to half-apply.

enum class Phase { LOBBY, REVEAL, CLUES, DISCUSSION, VOTING, REVOTE, GUESS, RESULTS, FINAL }

enum class Lang(val code: String) {
    EN("en"),
    AR("ar");

    // A companion object holds "static" members in Kotlin.
    companion object {
        fun fromCode(code: String): Lang? = entries.firstOrNull { it.code == code }
    }
}

object Rules {
    const val MIN_PLAYERS = 3
    const val MAX_PLAYERS = 12
    const val AVATAR_COUNT = 24
    const val MAX_NAME_LENGTH = 20
    const val MAX_CLUE_LENGTH = 30
    const val MAX_GUESS_LENGTH = 40

    const val REVEAL_MS = 30_000L
    const val VOTE_MS = 30_000L
    const val REVOTE_MS = 20_000L
    const val GUESS_MS = 30_000L
    const val GRACE_MS = 60_000L
    const val EMPTY_ROOM_MS = 10 * 60_000L
    /** How many recently played word ids each phone may report, to avoid repeats across parties. */
    const val MAX_RECENT_WORDS = 300

    val ROUNDS = 1..10
    val TURN_SECONDS = 10..60
    val DISCUSSION_SECONDS = 30..300
    /** How many times the turn order goes around for one word before the discussion. */
    val CLUE_ROUNDS = 1..5

    fun maxImposters(players: Int): Int = maxOf(1, (players - 1) / 2)
}

data class Settings(
    /** A category slug, or [RANDOM_CATEGORY]. */
    val category: String = RANDOM_CATEGORY,
    val language: Lang = Lang.EN,
    val imposterCount: Int = 1,
    val impostersKnowEachOther: Boolean = false,
    val rounds: Int = 3,
    val turnSeconds: Int = 20,
    val discussionSeconds: Int = 90,
    val clueRounds: Int = 1,
) {
    companion object {
        const val RANDOM_CATEGORY = "random"
    }
}

/** A partial settings update. Null fields are left unchanged. */
data class SettingsPatch(
    val category: String? = null,
    val language: Lang? = null,
    val imposterCount: Int? = null,
    val impostersKnowEachOther: Boolean? = null,
    val rounds: Int? = null,
    val turnSeconds: Int? = null,
    val discussionSeconds: Int? = null,
    val clueRounds: Int? = null,
)

data class Player(
    val id: String,
    val token: String,
    val name: String,
    val avatar: Int,
    val joinedAt: Long,
    val connected: Boolean = false,
    /** When the current connection started; used to pick the next admin. */
    val connectedSince: Long? = null,
    /** When the seat's 60s grace period started. Null while connected. */
    val disconnectedAt: Long? = null,
    /** Joined mid-game; enters at the start of the next game. */
    val waiting: Boolean = false,
    /** Words this player's phone played recently, in any party. New rounds avoid them while others are left. */
    val recentWordIds: Set<Int> = emptySet(),
)

data class Clue(
    val playerId: String,
    val text: String?,
    val skipped: Boolean,
    /** How long the turn took. Null for skipped turns. */
    val durationMs: Long? = null,
)

data class GuessAttempt(val text: String, val correct: Boolean)

data class Round(
    val number: Int,
    val category: String,
    val wordId: Int,
    val word: String,
    val imposterIds: Set<String>,
    /** Seated, non-waiting players when the round started. */
    val participantIds: List<String>,
    val turnOrder: List<String>,
    /** Times the turn order goes around before the discussion (the clue rounds setting when it started). */
    val clueRounds: Int = 1,
    /** Counts every turn across all clue rounds: turn i belongs to turnOrder[i % turnOrder.size]. */
    val currentTurnIndex: Int = -1,
    val turnStartedAt: Long = 0,
    val readyIds: Set<String> = emptySet(),
    val clues: List<Clue> = emptyList(),
    val votes: Map<String, List<String>> = emptyMap(),
    val revotes: Map<String, List<String>> = emptyMap(),
    /** Players caught outright in the first vote when a revote decides the remaining slots. */
    val lockedIds: Set<String> = emptySet(),
    val revoteCandidates: Set<String> = emptySet(),
    val revoteSlots: Int = 0,
    /**
     * Who votes in the revote: everyone outside the tie. Tied players would only cancel each other out
     * (with two tied, each could only pick the other), so they sit out, unless everyone is tied.
     */
    val revoteVoterIds: Set<String> = emptySet(),
    val caughtIds: Set<String> = emptySet(),
    val guesses: Map<String, GuessAttempt> = emptyMap(),
) {
    val totalTurns: Int get() = turnOrder.size * clueRounds
    val currentPlayerId: String?
        get() = if (currentTurnIndex in 0 until totalTurns) turnOrder[currentTurnIndex % turnOrder.size] else null

    /** The clue round in progress, from 1. */
    val clueRound: Int get() = if (turnOrder.isEmpty()) 1 else (currentTurnIndex.coerceIn(0, totalTurns - 1) / turnOrder.size) + 1
    val caughtImposterIds: Set<String> get() = caughtIds intersect imposterIds
}

data class PlayerStats(
    val survivedAsImposter: Int = 0,
    val correctVotes: Int = 0,
    val votesReceivedAsCrew: Int = 0,
    val correctGuesses: Int = 0,
    val clueCount: Int = 0,
    val clueMsTotal: Long = 0,
    /** Consecutive crew rounds where the player voted for at least one imposter. */
    val catchStreak: Int = 0,
    val bestCatchStreak: Int = 0,
)

data class Room(
    val code: String,
    val adminId: String,
    val settings: Settings,
    /** Insertion-ordered (Kotlin's map builders are LinkedHashMaps), so join order is preserved. */
    val players: Map<String, Player>,
    val phase: Phase = Phase.LOBBY,
    val endsAt: Long? = null,
    /** Bumped on every phase timer change; a fired timer with an old seq is stale and ignored. */
    val timerSeq: Int = 0,
    val round: Round? = null,
    val usedWordIds: Set<Int> = emptySet(),
    val scores: Map<String, Int> = emptyMap(),
    val stats: Map<String, PlayerStats> = emptyMap(),
    val lastResult: RoundResult? = null,
    val finalResult: FinalResult? = null,
    val emptySince: Long? = null,
)

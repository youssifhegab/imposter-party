package com.imposter.engine

// Effects describe what should happen in the outside world. The engine only returns them; the socket layer
// (Milestone 3) performs them. This is what keeps the engine free of sockets and real time.

sealed interface Recipient {
    data object All : Recipient
    data class One(val playerId: String) : Recipient
}

enum class ErrorCode {
    UNKNOWN_PLAYER,
    NOT_ADMIN,
    WRONG_PHASE,
    NOT_IN_GAME,
    NOT_YOUR_TURN,
    NOT_ALLOWED,
    ALREADY_DONE,
    INVALID_INPUT,
    NOT_ENOUGH_PLAYERS,
    TOO_MANY_IMPOSTERS,
    ROOM_FULL,
    NAME_TAKEN,
    NO_WORDS,
}

data class RoleInfo(
    val isImposter: Boolean,
    val category: String,
    val categoryName: String,
    val word: String?,
    val fellowImposterIds: List<String>?,
)

data class RoundResult(
    val roundNumber: Int,
    /** Lets each phone remember the word, so later parties can avoid it. */
    val wordId: Int,
    val votes: Map<String, List<String>>,
    /** Null when no revote happened. */
    val revotes: Map<String, List<String>>?,
    val caughtIds: Set<String>,
    val imposterIds: Set<String>,
    val word: String,
    val categoryName: String,
    val guesses: Map<String, GuessAttempt>,
    val points: Map<String, Int>,
    val scores: Map<String, Int>,
    val catchStreaks: Map<String, Int>,
)

data class LeaderboardEntry(val playerId: String, val score: Int, val rank: Int)

enum class AwardType { MASTER_OF_DISGUISE, DETECTIVE, MOST_SUSPICIOUS, MIND_READER, SPEED_DEMON }

/** [value] is a count, except for SPEED_DEMON where it is the average clue time in ms. Ties share an award. */
data class Award(val type: AwardType, val playerIds: List<String>, val value: Long)

data class FinalResult(val leaderboard: List<LeaderboardEntry>, val awards: List<Award>)

sealed interface Effect {
    /** Send the public room snapshot to everyone. Emitted automatically whenever the room changed. */
    data object BroadcastState : Effect

    /** Send the public room snapshot to one player, e.g. a fresh socket. */
    data class SendState(val playerId: String) : Effect
    data class SendRole(val playerId: String, val role: RoleInfo) : Effect
    data class SendRoundResult(val to: Recipient, val result: RoundResult) : Effect
    data class SendFinalResult(val to: Recipient, val result: FinalResult) : Effect
    data class SendError(val playerId: String, val code: ErrorCode) : Effect

    /** Tell a caught imposter, privately, that it is their turn to guess the word. */
    data class PromptGuess(val playerId: String) : Effect
    data class Kicked(val playerId: String) : Effect
    data class ScheduleTimer(val key: TimerKey, val at: Long) : Effect
    data object DeleteRoom : Effect
}

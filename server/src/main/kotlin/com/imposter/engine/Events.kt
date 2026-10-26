package com.imposter.engine

// A sealed interface is a closed set of types: the compiler knows every subtype, so a `when` over an Event
// must handle all of them. Adding a new event becomes a compile error everywhere it isn't handled yet.

sealed interface Event {
    data class Join(val playerId: String, val token: String, val name: String, val avatar: Int) : Event
    /** [recentWordIds]: what the phone says it played recently; null when it didn't say (keep what we had). */
    data class Connected(val playerId: String, val recentWordIds: List<Int>? = null) : Event
    data class Disconnected(val playerId: String) : Event
    data class UpdateSettings(val playerId: String, val patch: SettingsPatch) : Event
    data class Kick(val playerId: String, val targetId: String) : Event
    data class StartGame(val playerId: String) : Event
    data class Ready(val playerId: String) : Event
    data class SubmitClue(val playerId: String, val text: String) : Event
    data class EndTurn(val playerId: String) : Event
    data class SkipDiscussion(val playerId: String) : Event
    data class Vote(val playerId: String, val targetIds: List<String>) : Event
    data class Guess(val playerId: String, val text: String) : Event
    data class NextRound(val playerId: String) : Event
    data class PlayAgain(val playerId: String) : Event

    /** The player leaves for good: their seat is released now instead of after the grace period. */
    data class Leave(val playerId: String) : Event
    data class TimerFired(val key: TimerKey) : Event
}

sealed interface TimerKey {
    /** The current phase (or clue turn) deadline. */
    data class PhaseTimer(val seq: Int) : TimerKey

    /** A disconnected player's seat-hold period. */
    data class Grace(val playerId: String) : TimerKey

    data object RoomCleanup : TimerKey
}

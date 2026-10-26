package com.imposter.protocol

import com.imposter.engine.Event
import com.imposter.engine.Lang
import com.imposter.engine.SettingsPatch

/** Messages a client sends over the socket. Mirrors "Client → server" in docs/protocol.md. */
sealed interface ClientMessage {
    /** [recentWordIds]: word ids this phone played recently (newest last), so new rounds can avoid them. */
    data class Hello(val playerToken: String, val roomCode: String, val recentWordIds: List<Int>? = null) : ClientMessage

    data class UpdateSettings(
        val category: String? = null,
        val language: String? = null,
        val imposterCount: Int? = null,
        val impostersKnowEachOther: Boolean? = null,
        val rounds: Int? = null,
        val turnSeconds: Int? = null,
        val discussionSeconds: Int? = null,
        val clueRounds: Int? = null,
    ) : ClientMessage

    data class Kick(val playerId: String) : ClientMessage
    data object StartGame : ClientMessage
    data object Ready : ClientMessage
    data class SubmitClue(val text: String) : ClientMessage
    data object EndTurn : ClientMessage
    data object SkipDiscussion : ClientMessage
    data class Vote(val targetIds: List<String>) : ClientMessage
    data class Guess(val text: String) : ClientMessage
    data object NextRound : ClientMessage
    data object PlayAgain : ClientMessage
    data object Leave : ClientMessage
    data object Ping : ClientMessage
}

/**
 * Turns a socket message into an engine event for the authenticated [playerId]. Returns null for messages
 * that are not game events (hello, ping) or that carry an invalid value, such as an unknown language.
 */
fun ClientMessage.toEvent(playerId: String): Event? = when (this) {
    is ClientMessage.Hello, ClientMessage.Ping -> null
    is ClientMessage.UpdateSettings -> {
        val lang = language?.let { Lang.fromCode(it) ?: return null }
        Event.UpdateSettings(
            playerId,
            SettingsPatch(
                category, lang, imposterCount, impostersKnowEachOther, rounds, turnSeconds, discussionSeconds, clueRounds,
            ),
        )
    }
    is ClientMessage.Kick -> Event.Kick(playerId, this.playerId)
    ClientMessage.StartGame -> Event.StartGame(playerId)
    ClientMessage.Ready -> Event.Ready(playerId)
    is ClientMessage.SubmitClue -> Event.SubmitClue(playerId, text)
    ClientMessage.EndTurn -> Event.EndTurn(playerId)
    ClientMessage.SkipDiscussion -> Event.SkipDiscussion(playerId)
    is ClientMessage.Vote -> Event.Vote(playerId, targetIds)
    is ClientMessage.Guess -> Event.Guess(playerId, text)
    ClientMessage.NextRound -> Event.NextRound(playerId)
    ClientMessage.PlayAgain -> Event.PlayAgain(playerId)
    ClientMessage.Leave -> Event.Leave(playerId)
}

package com.imposter.protocol

import com.imposter.engine.Clue
import com.imposter.engine.ErrorCode
import com.imposter.engine.Phase
import com.imposter.engine.Room
import com.imposter.engine.Settings

/** Server → client message types. Mirrors docs/protocol.md. */
object MessageType {
    const val ROOM_STATE = "room_state"
    const val ROLE = "role"
    const val GUESS_PROMPT = "guess_prompt"
    const val ROUND_RESULT = "round_result"
    const val FINAL_RESULT = "final_result"
    const val KICKED = "kicked"
    const val ERROR = "error"
    const val PONG = "pong"
}

/** Error codes that come from the protocol layer rather than the game engine. */
object ProtocolError {
    const val INVALID_MESSAGE = "invalid_message"
    const val NOT_JOINED = "not_joined"
    const val ROOM_NOT_FOUND = "room_not_found"
    const val INVALID_TOKEN = "invalid_token"
    const val INVALID_INPUT = "invalid_input"
    const val RATE_LIMITED = "rate_limited"
}

val ErrorCode.wire: String get() = name.lowercase()

data class ErrorPayload(val code: String, val message: String) {
    companion object {
        fun of(code: String) = ErrorPayload(code, code.replace('_', ' '))
    }
}

data class SettingsPayload(
    val category: String,
    val language: String,
    val imposterCount: Int,
    val impostersKnowEachOther: Boolean,
    val rounds: Int,
    val turnSeconds: Int,
    val discussionSeconds: Int,
    val clueRounds: Int,
) {
    companion object {
        fun of(s: Settings) = SettingsPayload(
            s.category, s.language.code, s.imposterCount, s.impostersKnowEachOther, s.rounds, s.turnSeconds,
            s.discussionSeconds, s.clueRounds,
        )
    }
}

data class PlayerPayload(
    val id: String,
    val name: String,
    val avatar: Int,
    val connected: Boolean,
    val isAdmin: Boolean,
    val score: Int,
    val ready: Boolean,
    val hasVoted: Boolean,
    val waiting: Boolean,
)

data class CluePayload(val playerId: String, val text: String?, val skipped: Boolean)

data class RoundPayload(
    val number: Int,
    val totalRounds: Int,
    val category: String,
    val turnOrder: List<String>,
    /** How many players each VOTING ballot names. Public anyway through settings. */
    val imposterCount: Int,
    /** The clue round in progress (from 1) and how many there are for this word. */
    val clueRound: Int,
    val clueRounds: Int,
    val currentPlayerId: String?,
    val clues: List<CluePayload>,
    val votedCount: Int,
    val voterCount: Int,
    val revoteCandidates: List<String>,
    val revoteSlots: Int,
    /** Who votes in the revote (everyone outside the tie, or everyone if all are tied). Empty otherwise. */
    val revoteVoterIds: List<String>,
)

data class RoomStatePayload(
    val code: String,
    val phase: Phase,
    val endsAt: Long?,
    /** The server clock when this was sent, so clients can correct for their own clock being off. */
    val serverTime: Long,
    val adminId: String,
    val settings: SettingsPayload,
    val players: List<PlayerPayload>,
    val round: RoundPayload?,
)

/**
 * Builds the snapshot everyone receives. This is the only place room state becomes public, so it must never
 * include the word, roles, individual votes, who was caught, or guesses. Those go out privately or at results.
 */
object PublicState {
    fun of(room: Room, now: Long): RoomStatePayload {
        val round = room.round?.takeIf { room.phase != Phase.LOBBY }
        val ballots = when (room.phase) {
            Phase.VOTING -> round?.votes?.keys
            Phase.REVOTE -> round?.revotes?.keys
            else -> null
        }.orEmpty()
        return RoomStatePayload(
            code = room.code,
            phase = room.phase,
            endsAt = room.endsAt,
            serverTime = now,
            adminId = room.adminId,
            settings = SettingsPayload.of(room.settings),
            players = room.players.values.map { p ->
                PlayerPayload(
                    id = p.id,
                    name = p.name,
                    avatar = p.avatar,
                    connected = p.connected,
                    isAdmin = p.id == room.adminId,
                    score = room.scores[p.id] ?: 0,
                    ready = round?.readyIds?.contains(p.id) == true,
                    hasVoted = p.id in ballots,
                    waiting = p.waiting,
                )
            },
            round = round?.let { r ->
                RoundPayload(
                    number = r.number,
                    totalRounds = room.settings.rounds,
                    category = r.category,
                    turnOrder = r.turnOrder,
                    imposterCount = r.imposterIds.size,
                    clueRound = r.clueRound,
                    clueRounds = r.clueRounds,
                    currentPlayerId = r.currentPlayerId.takeIf { room.phase == Phase.CLUES },
                    clues = r.clues.map(Clue::toPayload),
                    votedCount = ballots.size,
                    voterCount = if (room.phase == Phase.REVOTE) {
                        r.revoteVoterIds.count { it in room.players }
                    } else {
                        r.participantIds.count { it in room.players }
                    },
                    revoteCandidates = r.revoteCandidates.toList(),
                    revoteSlots = r.revoteSlots,
                    revoteVoterIds = r.revoteVoterIds.toList(),
                )
            },
        )
    }
}

private fun Clue.toPayload() = CluePayload(playerId, text, skipped)

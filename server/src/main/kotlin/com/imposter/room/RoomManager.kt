package com.imposter.room

import com.imposter.engine.Effect
import com.imposter.engine.Event
import com.imposter.engine.GameEngine
import com.imposter.engine.Lang
import com.imposter.protocol.ProtocolCodec
import com.imposter.protocol.ProtocolError
import com.imposter.protocol.wire
import jakarta.annotation.PreDestroy
import kotlinx.coroutines.channels.ClosedSendChannelException
import org.springframework.stereotype.Service
import java.security.SecureRandom
import java.time.Clock
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

data class Credentials(val roomCode: String, val playerId: String, val playerToken: String)

sealed interface JoinResult {
    data class Joined(val credentials: Credentials) : JoinResult
    data class Rejected(val code: String) : JoinResult
}

/** Creates, finds, and forgets rooms. Each room lives in its own [RoomActor]. */
@Service
class RoomManager(
    private val engine: GameEngine,
    private val codec: ProtocolCodec,
    private val clock: Clock,
) {
    private val rooms = ConcurrentHashMap<String, RoomActor>()
    private val random = SecureRandom()

    fun find(code: String): RoomActor? = rooms[code.trim().uppercase()]

    val roomCount: Int get() = rooms.size

    /** Expects an already validated name and avatar; the engine throws IllegalArgumentException otherwise. */
    fun create(name: String, avatar: Int, language: Lang): Credentials {
        val playerId = newPlayerId()
        val token = newToken()
        while (true) {
            val code = newRoomCode()
            if (rooms.containsKey(code)) continue
            val (room, effects) = engine.createRoom(code, playerId, token, name, avatar, language)
            val actor = RoomActor(room, effects, engine, clock, codec, onDeleted = { rooms.remove(it) })
            if (rooms.putIfAbsent(code, actor) == null) return Credentials(code, playerId, token)
            actor.stop() // Lost a race for this code; try another.
        }
    }

    // `suspend` marks a function that can pause without blocking a thread, like an async function in JS.
    suspend fun join(code: String, name: String, avatar: Int): JoinResult {
        val actor = find(code) ?: return JoinResult.Rejected(ProtocolError.ROOM_NOT_FOUND)
        val playerId = newPlayerId()
        val token = newToken()
        val effects = try {
            actor.apply(Event.Join(playerId, token, name, avatar))
        } catch (e: ClosedSendChannelException) {
            return JoinResult.Rejected(ProtocolError.ROOM_NOT_FOUND) // Deleted while we were joining.
        }
        val error = effects.filterIsInstance<Effect.SendError>().firstOrNull { it.playerId == playerId }
        return if (error == null) {
            JoinResult.Joined(Credentials(actor.code, playerId, token))
        } else {
            JoinResult.Rejected(error.code.wire)
        }
    }

    @PreDestroy
    fun shutdown() {
        rooms.values.forEach { it.stop() }
        rooms.clear()
    }

    private fun newRoomCode(): String = (1..ROOM_CODE_LENGTH)
        .map { ROOM_CODE_ALPHABET[random.nextInt(ROOM_CODE_ALPHABET.length)] }
        .joinToString("")

    private fun newPlayerId(): String = randomString(9)

    private fun newToken(): String = randomString(32)

    private fun randomString(bytes: Int): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(bytes).also(random::nextBytes))

    companion object {
        const val ROOM_CODE_LENGTH = 5

        // No 0/O, 1/I/L: easy to read out loud and type.
        const val ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    }
}

package com.imposter.room

import com.imposter.engine.Effect
import com.imposter.engine.Event
import com.imposter.engine.GameEngine
import com.imposter.engine.Recipient
import com.imposter.engine.Room
import com.imposter.protocol.ClientMessage
import com.imposter.protocol.ErrorPayload
import com.imposter.protocol.MessageType
import com.imposter.protocol.ProtocolCodec
import com.imposter.protocol.ProtocolError
import com.imposter.protocol.PublicState
import com.imposter.protocol.toEvent
import com.imposter.protocol.wire
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import java.security.MessageDigest
import java.time.Clock

/**
 * Owns one room. Everything that touches the room goes through [inbox] and is handled by a single coroutine,
 * one command at a time (the actor pattern). Socket threads and timers only enqueue commands, so the room
 * state and the socket maps below never need locks and can never race.
 */
class RoomActor(
    initialRoom: Room,
    initialEffects: List<Effect>,
    private val engine: GameEngine,
    private val clock: Clock,
    private val codec: ProtocolCodec,
    private val onDeleted: (code: String) -> Unit,
) {
    val code: String = initialRoom.code

    private val log = LoggerFactory.getLogger(RoomActor::class.java)

    // A scope ties coroutines together: cancelling it stops the actor loop and every pending timer at once.
    // SupervisorJob means one failing child (e.g. a timer) doesn't cancel its siblings.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default + CoroutineName("room-$code"))
    private val inbox = Channel<Command>(Channel.UNLIMITED)

    // Only read or written inside the actor coroutine.
    private var room = initialRoom
    private val socketByPlayer = mutableMapOf<String, WebSocketSession>()
    private val playerBySocket = mutableMapOf<String, String>()

    private sealed interface Command {
        data class Apply(val event: Event, val reply: CompletableDeferred<List<Effect>>? = null) : Command
        data class Hello(val socket: WebSocketSession, val token: String, val recentWordIds: List<Int>?) : Command
        data class Message(val socket: WebSocketSession, val message: ClientMessage) : Command
        data class Closed(val socket: WebSocketSession) : Command
        data class Inspect(val reply: CompletableDeferred<Room>) : Command
    }

    init {
        scope.launch {
            perform(initialEffects)
            for (command in inbox) {
                try {
                    process(command)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    // A bug in one command must not take the whole room down.
                    log.error("Room {} failed to process {}", code, command, e)
                }
            }
        }
    }

    // region Public API. Safe to call from any thread: each call only enqueues a command.

    /** Applies [event] and returns the effects it produced. Throws ClosedSendChannelException once deleted. */
    suspend fun apply(event: Event): List<Effect> {
        val reply = CompletableDeferred<List<Effect>>()
        inbox.send(Command.Apply(event, reply))
        return reply.await()
    }

    fun hello(socket: WebSocketSession, token: String, recentWordIds: List<Int>? = null) {
        inbox.trySend(Command.Hello(socket, token, recentWordIds))
    }

    fun message(socket: WebSocketSession, message: ClientMessage) {
        inbox.trySend(Command.Message(socket, message))
    }

    fun closed(socket: WebSocketSession) {
        inbox.trySend(Command.Closed(socket))
    }

    /** A copy of the current room, for tests and diagnostics. */
    suspend fun snapshot(): Room {
        val reply = CompletableDeferred<Room>()
        inbox.send(Command.Inspect(reply))
        return reply.await()
    }

    fun stop() {
        inbox.close()
        scope.cancel()
    }

    // endregion

    private fun process(command: Command) {
        when (command) {
            is Command.Apply -> {
                val effects = handle(command.event)
                command.reply?.complete(effects)
            }
            is Command.Hello -> hello(command)
            is Command.Message -> {
                val playerId = playerBySocket[command.socket.id]
                    ?: return sendError(command.socket, ProtocolError.NOT_JOINED)
                val event = command.message.toEvent(playerId)
                    ?: return sendError(command.socket, ProtocolError.INVALID_INPUT)
                handle(event)
            }
            is Command.Closed -> {
                val playerId = playerBySocket.remove(command.socket.id) ?: return
                // Ignore a stale socket that was already replaced by a newer one for the same player.
                if (socketByPlayer[playerId]?.id == command.socket.id) {
                    socketByPlayer.remove(playerId)
                    handle(Event.Disconnected(playerId))
                }
            }
            is Command.Inspect -> command.reply.complete(room)
        }
    }

    private fun hello(command: Command.Hello) {
        val socket = command.socket
        // Constant-time comparison, so response timing can't leak how much of a token matched.
        val player = room.players.values.firstOrNull {
            MessageDigest.isEqual(it.token.toByteArray(), command.token.toByteArray())
        }
        if (player == null) {
            sendError(socket, ProtocolError.INVALID_TOKEN)
            close(socket, CloseStatus.POLICY_VIOLATION)
            return
        }
        val previous = socketByPlayer.put(player.id, socket)
        if (previous != null && previous.id != socket.id) {
            playerBySocket.remove(previous.id)
            close(previous, CloseStatus.NORMAL.withReason("replaced by a newer connection"))
        }
        playerBySocket[socket.id] = player.id
        handle(Event.Connected(player.id, command.recentWordIds))
    }

    private fun handle(event: Event): List<Effect> {
        val (next, effects) = engine.handle(room, event)
        room = next
        perform(effects)
        return effects
    }

    private fun perform(effects: List<Effect>) {
        for (effect in effects) {
            when (effect) {
                Effect.BroadcastState -> {
                    val text = codec.encode(MessageType.ROOM_STATE, PublicState.of(room, clock.millis()))
                    socketByPlayer.values.forEach { send(it, text) }
                }
                is Effect.SendState -> sendTo(effect.playerId, MessageType.ROOM_STATE, PublicState.of(room, clock.millis()))
                is Effect.SendRole -> sendTo(effect.playerId, MessageType.ROLE, effect.role)
                is Effect.PromptGuess -> sendTo(effect.playerId, MessageType.GUESS_PROMPT, emptyMap<String, Any>())
                is Effect.SendRoundResult -> deliver(effect.to, MessageType.ROUND_RESULT, effect.result)
                is Effect.SendFinalResult -> deliver(effect.to, MessageType.FINAL_RESULT, effect.result)
                is Effect.SendError -> sendTo(effect.playerId, MessageType.ERROR, ErrorPayload.of(effect.code.wire))
                is Effect.Kicked -> socketByPlayer.remove(effect.playerId)?.let { socket ->
                    playerBySocket.remove(socket.id)
                    send(socket, codec.encode(MessageType.KICKED, emptyMap<String, Any>()))
                    close(socket, CloseStatus.NORMAL.withReason("kicked"))
                }
                is Effect.ScheduleTimer -> scope.launch {
                    delay(effect.at - clock.millis())
                    inbox.send(Command.Apply(Event.TimerFired(effect.key)))
                }
                Effect.DeleteRoom -> {
                    onDeleted(code)
                    socketByPlayer.values.forEach { close(it, CloseStatus.GOING_AWAY) }
                    stop()
                }
            }
        }
    }

    private fun deliver(to: Recipient, type: String, payload: Any) {
        when (to) {
            Recipient.All -> {
                val text = codec.encode(type, payload)
                socketByPlayer.values.forEach { send(it, text) }
            }
            is Recipient.One -> sendTo(to.playerId, type, payload)
        }
    }

    private fun sendTo(playerId: String, type: String, payload: Any) {
        socketByPlayer[playerId]?.let { send(it, codec.encode(type, payload)) }
    }

    private fun sendError(socket: WebSocketSession, code: String) {
        send(socket, codec.encode(MessageType.ERROR, ErrorPayload.of(code)))
    }

    private fun send(socket: WebSocketSession, text: String) {
        try {
            socket.sendMessage(TextMessage(text))
        } catch (e: Exception) {
            // The socket died mid-send. Its close callback will mark the player disconnected.
            log.debug("Send to {} failed: {}", socket.id, e.message)
        }
    }

    private fun close(socket: WebSocketSession, status: CloseStatus) {
        try {
            socket.close(status)
        } catch (e: Exception) {
            log.debug("Close of {} failed: {}", socket.id, e.message)
        }
    }
}

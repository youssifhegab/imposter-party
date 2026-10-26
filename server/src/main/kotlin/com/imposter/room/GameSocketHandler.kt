package com.imposter.room

import com.imposter.protocol.ClientMessage
import com.imposter.protocol.ErrorPayload
import com.imposter.protocol.MessageType
import com.imposter.protocol.ProtocolCodec
import com.imposter.protocol.ProtocolError
import com.imposter.protocol.ProtocolException
import org.springframework.stereotype.Component
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.util.concurrent.ConcurrentHashMap

/**
 * The raw WebSocket endpoint at /ws. It parses messages and hands them to the right room; it never touches
 * game state itself. Spring calls these methods on its own threads, so the maps here are concurrent.
 */
@Component
class GameSocketHandler(
    private val rooms: RoomManager,
    private val codec: ProtocolCodec,
) : TextWebSocketHandler() {
    private val sockets = ConcurrentHashMap<String, WebSocketSession>()
    private val roomBySocket = ConcurrentHashMap<String, RoomActor>()

    override fun afterConnectionEstablished(session: WebSocketSession) {
        // A raw session must not be written to from two threads at once (the room actor and pong replies).
        // The decorator serializes sends and drops a client that stops reading.
        sockets[session.id] = ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, SEND_BUFFER_LIMIT)
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        val socket = sockets[session.id] ?: return
        val parsed = try {
            codec.decode(message.payload)
        } catch (e: ProtocolException) {
            return sendError(socket, ProtocolError.INVALID_MESSAGE)
        }
        when (parsed) {
            ClientMessage.Ping -> socket.sendMessage(TextMessage(codec.encode(MessageType.PONG, emptyMap<String, Any>())))
            is ClientMessage.Hello -> {
                val room = rooms.find(parsed.roomCode)
                if (room == null) {
                    sendError(socket, ProtocolError.ROOM_NOT_FOUND)
                    socket.close(CloseStatus.POLICY_VIOLATION)
                    return
                }
                // A socket belongs to one room. A hello for a different room detaches it from the old one.
                roomBySocket.put(session.id, room)?.takeIf { it !== room }?.closed(socket)
                room.hello(socket, parsed.playerToken, parsed.recentWordIds)
            }
            else -> roomBySocket[session.id]?.message(socket, parsed) ?: sendError(socket, ProtocolError.NOT_JOINED)
        }
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        val socket = sockets.remove(session.id) ?: return
        roomBySocket.remove(session.id)?.closed(socket)
    }

    private fun sendError(socket: WebSocketSession, code: String) {
        socket.sendMessage(TextMessage(codec.encode(MessageType.ERROR, ErrorPayload.of(code))))
    }

    companion object {
        private const val SEND_TIME_LIMIT_MS = 5_000
        private const val SEND_BUFFER_LIMIT = 256 * 1024
    }
}

package com.imposter.protocol

import com.fasterxml.jackson.core.JacksonException
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.stereotype.Component

class ProtocolException(message: String) : RuntimeException(message)

/**
 * Reads and writes the `{"type": ..., "payload": ...}` envelope.
 *
 * @Component makes this a Spring bean: Spring creates one instance at startup and passes it to any constructor
 * that asks for a ProtocolCodec. The ObjectMapper it receives is Spring Boot's, already set up for Kotlin.
 */
@Component
class ProtocolCodec(private val mapper: ObjectMapper) {
    private val withPayload: Map<String, Class<out ClientMessage>> = mapOf(
        "hello" to ClientMessage.Hello::class.java,
        "update_settings" to ClientMessage.UpdateSettings::class.java,
        "kick" to ClientMessage.Kick::class.java,
        "submit_clue" to ClientMessage.SubmitClue::class.java,
        "vote" to ClientMessage.Vote::class.java,
        "guess" to ClientMessage.Guess::class.java,
    )

    private val withoutPayload: Map<String, ClientMessage> = mapOf(
        "start_game" to ClientMessage.StartGame,
        "ready" to ClientMessage.Ready,
        "end_turn" to ClientMessage.EndTurn,
        "skip_discussion" to ClientMessage.SkipDiscussion,
        "next_round" to ClientMessage.NextRound,
        "play_again" to ClientMessage.PlayAgain,
        "leave" to ClientMessage.Leave,
        "ping" to ClientMessage.Ping,
    )

    fun decode(text: String): ClientMessage {
        val tree = try {
            mapper.readTree(text)
        } catch (e: JacksonException) {
            throw ProtocolException("malformed JSON")
        }
        val type = tree?.get("type")?.takeIf { it.isTextual }?.asText() ?: throw ProtocolException("missing type")
        withoutPayload[type]?.let { return it }
        val target = withPayload[type] ?: throw ProtocolException("unknown type: $type")
        val payload = tree.get("payload")?.takeIf { it.isObject } ?: throw ProtocolException("missing payload")
        return try {
            mapper.treeToValue(payload, target)
        } catch (e: JacksonException) {
            throw ProtocolException("invalid payload for $type")
        }
    }

    fun encode(type: String, payload: Any): String =
        mapper.writeValueAsString(mapOf("type" to type, "payload" to payload))
}

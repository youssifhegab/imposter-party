package com.imposter.room

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.imposter.engine.Fixtures
import com.imposter.engine.WordBank
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.test.context.ActiveProfiles
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import kotlin.test.fail

@TestConfiguration
class TestContent {
    @Bean
    fun wordBank(): WordBank = Fixtures.bank
}

data class Creds(val roomCode: String, val playerId: String, val playerToken: String)

/**
 * A fake phone: a real WebSocket client that records every message it receives. Lookups search the whole
 * history instead of consuming a queue, because messages for one step (e.g. `role` then `room_state`) can
 * arrive in either order relative to when the test starts waiting.
 */
class TestClient(private val mapper: ObjectMapper, val creds: Creds) : TextWebSocketHandler() {
    val raw = CopyOnWriteArrayList<String>()
    private val messages = CopyOnWriteArrayList<JsonNode>()
    private lateinit var session: WebSocketSession

    @Volatile
    var closeStatus: CloseStatus? = null

    val id: String get() = creds.playerId

    override fun afterConnectionEstablished(session: WebSocketSession) {
        this.session = session
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        raw.add(message.payload)
        messages.add(mapper.readTree(message.payload))
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        closeStatus = status
    }

    fun send(type: String, payload: Any = emptyMap<String, Any>()) = sendRaw(mapper.writeValueAsString(mapOf("type" to type, "payload" to payload)))

    @Synchronized
    fun sendRaw(text: String) = session.sendMessage(TextMessage(text))

    fun hello() = send("hello", mapOf("playerToken" to creds.playerToken, "roomCode" to creds.roomCode))

    fun close() = session.close()

    fun all(type: String): List<JsonNode> = messages.filter { it["type"].asText() == type }.map { it["payload"] }

    fun last(type: String): JsonNode? = all(type).lastOrNull()

    /** Waits until some received message of [type] matches [where], and returns its payload. */
    fun await(type: String, timeoutMs: Long = 5_000, where: (JsonNode) -> Boolean = { true }): JsonNode {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            all(type).lastOrNull(where)?.let { return it }
            Thread.sleep(10)
        }
        fail("$id timed out waiting for $type. Last messages:\n${raw.takeLast(5).joinToString("\n")}")
    }

    fun awaitState(timeoutMs: Long = 5_000, where: (JsonNode) -> Boolean) = await("room_state", timeoutMs, where)

    fun awaitPhase(phase: String, round: Int? = null) =
        awaitState { it["phase"].asText() == phase && (round == null || it["round"]["number"].asInt() == round) }

    fun awaitCount(type: String, count: Int, timeoutMs: Long = 5_000) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (all(type).size >= count) return
            Thread.sleep(10)
        }
        fail("$id expected $count $type messages, got ${all(type).size}")
    }

    fun awaitClosed(timeoutMs: Long = 5_000): CloseStatus {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            closeStatus?.let { return it }
            Thread.sleep(10)
        }
        fail("$id was not closed")
    }
}

/** Boots the real server on a random port with the in-memory word bank. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(TestContent::class)
abstract class SocketTestBase {
    @LocalServerPort
    var port: Int = 0

    @Autowired
    lateinit var rest: TestRestTemplate

    @Autowired
    lateinit var mapper: ObjectMapper

    private val clients = mutableListOf<TestClient>()

    @org.junit.jupiter.api.AfterEach
    fun closeClients() {
        clients.forEach { runCatching { it.close() } }
        clients.clear()
    }

    fun createRoom(name: String = "Alice"): Creds {
        val body = rest.postForObject("/api/rooms", mapOf("name" to name, "avatar" to 0, "language" to "en"), Creds::class.java)
        return body!!
    }

    fun joinRoom(code: String, name: String): Creds =
        rest.postForObject("/api/rooms/$code/join", mapOf("name" to name, "avatar" to 1), Creds::class.java)!!

    fun connect(creds: Creds, hello: Boolean = true): TestClient {
        val client = TestClient(mapper, creds)
        StandardWebSocketClient().execute(client, "ws://localhost:$port/ws").get(5, TimeUnit.SECONDS)
        clients += client
        if (hello) client.hello()
        return client
    }

    /** Creates a room with [count] connected players; the first is the admin. */
    fun party(count: Int): List<TestClient> {
        val admin = createRoom("Player1")
        val creds = listOf(admin) + (2..count).map { joinRoom(admin.roomCode, "Player$it") }
        val players = creds.map { connect(it) }
        players.forEach { p -> p.awaitState { s -> s["players"].count { it["connected"].asBoolean() } == count } }
        return players
    }
}

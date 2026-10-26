package com.imposter.room

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RoomSocketIntegrationTest : SocketTestBase() {
    @Autowired
    lateinit var rooms: RoomManager

    private fun post(path: String, body: Any) = rest.postForEntity(path, body, String::class.java)
        .let { it.statusCode to mapper.readTree(it.body) }

    @Test
    fun `health and categories`() {
        assertEquals(HttpStatus.OK, rest.getForEntity("/api/health", String::class.java).statusCode)
        val en = mapper.readTree(rest.getForObject("/api/categories?lang=en", String::class.java))
        assertEquals(listOf("food", "animals", "places"), en.map { it["id"].asText() })
        assertEquals("Food", en[0]["name"].asText())
        assertEquals(4, en[0]["wordCount"].asInt())
        val ar = mapper.readTree(rest.getForObject("/api/categories?lang=ar", String::class.java))
        assertEquals(listOf("طعام"), ar.map { it["name"].asText() })
    }

    @Test
    fun `browsers on another origin may call the REST API`() {
        val headers = HttpHeaders().apply { origin = "http://localhost:8081" }
        val response = rest.exchange("/api/health", HttpMethod.GET, HttpEntity<Unit>(headers), String::class.java)
        assertEquals("*", response.headers.accessControlAllowOrigin)
    }

    @Test
    fun `REST join errors`() {
        val room = createRoom()
        val (missingStatus, missing) = post("/api/rooms/ZZZZZ/join", mapOf("name" to "Bob", "avatar" to 1))
        assertEquals(HttpStatus.NOT_FOUND, missingStatus)
        assertEquals("room_not_found", missing["code"].asText())

        val (takenStatus, taken) = post("/api/rooms/${room.roomCode}/join", mapOf("name" to " alice ", "avatar" to 1))
        assertEquals(HttpStatus.CONFLICT, takenStatus)
        assertEquals("name_taken", taken["code"].asText())

        val (badStatus, bad) = post("/api/rooms/${room.roomCode}/join", mapOf("avatar" to 1))
        assertEquals(HttpStatus.BAD_REQUEST, badStatus)
        assertEquals("invalid_input", bad["code"].asText())

        assertEquals(HttpStatus.BAD_REQUEST, post("/api/rooms", mapOf("name" to "Al", "avatar" to 99)).first)
        assertEquals(HttpStatus.BAD_REQUEST, post("/api/rooms", mapOf("name" to "Al", "avatar" to 1, "language" to "fr")).first)
    }

    @Test
    fun `room codes are 5 readable characters and joining ignores case`() {
        val room = createRoom()
        assertTrue(room.roomCode.matches(Regex("[${RoomManager.ROOM_CODE_ALPHABET}]{5}")))
        val joined = joinRoom(room.roomCode.lowercase(), "Bob")
        assertEquals(room.roomCode, joined.roomCode)
    }

    @Test
    fun `socket errors for bad tokens, missing hello, and garbage`() {
        val room = createRoom()
        val intruder = connect(room.copy(playerToken = "wrong"))
        intruder.await("error") { it["code"].asText() == "invalid_token" }
        intruder.awaitClosed()

        val early = connect(room, hello = false)
        early.send("start_game")
        early.await("error") { it["code"].asText() == "not_joined" }
        early.sendRaw("{nope")
        early.await("error") { it["code"].asText() == "invalid_message" }
        early.send("ping")
        early.await("pong")

        val lost = connect(room.copy(roomCode = "ZZZZZ"))
        lost.await("error") { it["code"].asText() == "room_not_found" }
    }

    @Test
    fun `admin-only actions are enforced`() {
        val (_, bob, _) = party(3)
        bob.send("start_game")
        bob.await("error") { it["code"].asText() == "not_admin" }
        bob.send("update_settings", mapOf("language" to "fr"))
        bob.await("error") { it["code"].asText() == "invalid_input" }
    }

    @Test
    fun `players rejoin by token after a dropped connection`() {
        val players = party(3)
        val (admin, bob, _) = players
        admin.send("start_game")
        players.forEach { it.awaitPhase("REVEAL") }
        val role = bob.last("role")!!

        bob.close()
        admin.awaitState { s -> s["players"].first { it["id"].asText() == bob.id }["connected"].asBoolean().not() }

        val again = connect(bob.creds)
        again.await("role")
        assertEquals(role, again.last("role"))
        again.awaitPhase("REVEAL")
        admin.awaitState { s -> s["players"].all { it["connected"].asBoolean() } }
    }

    @Test
    fun `a newer connection replaces the old one`() {
        val (_, bob, _) = party(3)
        val second = connect(bob.creds)
        second.awaitState { true }
        bob.awaitClosed()
    }

    @Test
    fun `kicked players are told and disconnected`() {
        val (admin, bob, carol) = party(3)
        admin.send("kick", mapOf("playerId" to bob.id))
        bob.await("kicked")
        bob.awaitClosed()
        carol.awaitState { s -> s["players"].none { it["id"].asText() == bob.id } }
    }

    @Test
    fun `server timers advance the game`() {
        val players = party(3)
        val admin = players.first()
        admin.send("update_settings", mapOf("turnSeconds" to 10))
        admin.awaitState { it["settings"]["turnSeconds"].asInt() == 10 }
        admin.send("start_game")
        players.forEach { it.awaitPhase("REVEAL") }
        players.forEach { it.send("ready") }
        val clues = admin.awaitPhase("CLUES")
        assertTrue(clues["endsAt"].asLong() > clues["serverTime"].asLong())
        // Nobody acts: the first turn times out on the server and is shown as skipped.
        admin.awaitState(timeoutMs = 13_000) { s -> s["round"]?.get("clues")?.any { it["skipped"].asBoolean() } == true }
    }

    @Test
    fun `rooms are tracked by the manager`() {
        val room = createRoom()
        assertTrue(rooms.find(room.roomCode) != null)
        assertFalse(rooms.find("QQQQQ") != null)
    }
}

package com.imposter.protocol

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.imposter.engine.Event
import com.imposter.engine.Harness
import com.imposter.engine.Phase
import com.imposter.engine.RoleInfo
import com.imposter.engine.SettingsPatch
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ProtocolTest {
    private val mapper = jacksonObjectMapper()
    private val codec = ProtocolCodec(mapper)

    @Test
    fun `decodes every client message type`() {
        assertEquals(ClientMessage.Hello("tok", "ABCDE"), codec.decode("""{"type":"hello","payload":{"playerToken":"tok","roomCode":"ABCDE"}}"""))
        assertEquals(
            ClientMessage.Hello("tok", "ABCDE", listOf(7, 42)),
            codec.decode("""{"type":"hello","payload":{"playerToken":"tok","roomCode":"ABCDE","recentWordIds":[7,42]}}"""),
        )
        assertEquals(ClientMessage.UpdateSettings(rounds = 4, language = "ar"), codec.decode("""{"type":"update_settings","payload":{"rounds":4,"language":"ar"}}"""))
        assertEquals(ClientMessage.Kick("p2"), codec.decode("""{"type":"kick","payload":{"playerId":"p2"}}"""))
        assertEquals(ClientMessage.SubmitClue("hot"), codec.decode("""{"type":"submit_clue","payload":{"text":"hot"}}"""))
        assertEquals(ClientMessage.Vote(listOf("a", "b")), codec.decode("""{"type":"vote","payload":{"targetIds":["a","b"]}}"""))
        assertEquals(ClientMessage.Guess("pizza"), codec.decode("""{"type":"guess","payload":{"text":"pizza"}}"""))
        for ((type, expected) in listOf(
            "start_game" to ClientMessage.StartGame,
            "ready" to ClientMessage.Ready,
            "end_turn" to ClientMessage.EndTurn,
            "skip_discussion" to ClientMessage.SkipDiscussion,
            "next_round" to ClientMessage.NextRound,
            "play_again" to ClientMessage.PlayAgain,
            "ping" to ClientMessage.Ping,
        )) {
            assertEquals(expected, codec.decode("""{"type":"$type","payload":{}}"""))
            assertEquals(expected, codec.decode("""{"type":"$type"}"""), "payload is optional for $type")
        }
    }

    @Test
    fun `rejects malformed messages`() {
        for (bad in listOf(
            "not json",
            "[]",
            """{"payload":{}}""",
            """{"type":"dance","payload":{}}""",
            """{"type":"vote"}""",
            """{"type":"vote","payload":{}}""",
            """{"type":"vote","payload":{"targetIds":"p2"}}""",
            """{"type":"hello","payload":{"playerToken":null,"roomCode":"ABCDE"}}""",
        )) {
            assertThrows<ProtocolException>(bad) { codec.decode(bad) }
        }
    }

    @Test
    fun `unknown language in settings is not a valid event`() {
        assertNull(ClientMessage.UpdateSettings(language = "fr").toEvent("p1"))
        assertTrue(ClientMessage.UpdateSettings(language = "ar").toEvent("p1") is Event.UpdateSettings)
    }

    @Test
    fun `JSON keys match the protocol`() {
        val role = mapper.readTree(codec.encode(MessageType.ROLE, RoleInfo(true, "food", "Food", null, listOf("p2"))))
        assertEquals("role", role["type"].asText())
        assertTrue(role["payload"]["isImposter"].asBoolean())
        assertTrue(role["payload"].has("word"))

        val h = Harness(3)
        val state = mapper.readTree(codec.encode(MessageType.ROOM_STATE, PublicState.of(h.room, 5)))["payload"]
        assertEquals("LOBBY", state["phase"].asText())
        assertEquals("en", state["settings"]["language"].asText())
        assertTrue(state["players"][0]["isAdmin"].asBoolean())
        assertFalse(state["players"][1]["isAdmin"].asBoolean())
        assertTrue(state["round"].isNull)
    }

    @Test
    fun `public state never contains secrets, in any phase`() {
        val h = Harness(5, SettingsPatch(imposterCount = 2, rounds = 1))
        val snapshots = mutableListOf<String>()
        fun capture() {
            snapshots += codec.encode(MessageType.ROOM_STATE, PublicState.of(h.room, h.now))
        }

        h.startGame()
        capture()
        h.allReady()
        capture()
        h.send(Event.SubmitClue(h.round.currentPlayerId!!, "spicy"))
        capture()
        h.playAllTurns()
        capture()
        h.send(Event.SkipDiscussion(h.admin))
        h.send(Event.Vote(h.crew.first(), h.imposters.toList()))
        capture()
        h.everyoneVotesFor(h.imposters)
        assertEquals(Phase.GUESS, h.room.phase)
        capture()

        val firstRound = mapper.readTree(snapshots.first())["payload"]["round"]
        assertEquals(2, firstRound["imposterCount"].asInt())
        assertEquals(1, firstRound["clueRound"].asInt())
        assertEquals(1, firstRound["clueRounds"].asInt())
        val word = h.round.word
        for (json in snapshots) {
            assertFalse(json.contains(word, ignoreCase = true), "word leaked: $json")
            val round = mapper.readTree(json)["payload"]["round"]
            for (secret in listOf("word", "wordId", "imposterIds", "votes", "revotes", "caughtIds", "lockedIds", "guesses")) {
                assertFalse(round.has(secret), "$secret leaked")
            }
        }
        val voting = mapper.readTree(snapshots[4])["payload"]
        assertEquals(1, voting["round"]["votedCount"].asInt())
        assertEquals(1, voting["players"].count { it["hasVoted"].asBoolean() })
    }
}

package com.imposter.room

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FullGameIntegrationTest : SocketTestBase() {
    @Test
    fun `four players complete a two-round game over real sockets`() {
        val players = party(4)
        val admin = players.first()
        val byId = players.associateBy { it.id }

        admin.send("update_settings", mapOf("rounds" to 2))
        players.forEach { p -> p.awaitState { it["settings"]["rounds"].asInt() == 2 } }

        val words = mutableListOf<String>()
        for (round in 1..2) {
            admin.send(if (round == 1) "start_game" else "next_round")
            players.forEach { it.awaitPhase("REVEAL", round) }

            // Each phone got its own private role before the state that announced the round.
            val roles = players.associate { it.id to it.last("role")!! }
            val imposterId = roles.filterValues { it["isImposter"].asBoolean() }.keys.single()
            val imposter = byId.getValue(imposterId)
            val word = roles.filterKeys { it != imposterId }.values.map { it["word"].asText() }.distinct().single()
            assertTrue(roles.getValue(imposterId)["word"].isNull)
            words += word

            players.forEach { it.send("ready") }
            players.forEach { it.awaitPhase("CLUES", round) }

            for (turn in 1..players.size) {
                val state = admin.awaitState {
                    it["phase"].asText() == "CLUES" && it["round"]["number"].asInt() == round &&
                        it["round"]["clues"].size() == turn - 1
                }
                byId.getValue(state["round"]["currentPlayerId"].asText()).send("submit_clue", mapOf("text" to "clue $turn"))
            }
            players.forEach { it.awaitPhase("DISCUSSION", round) }
            assertEquals(4, admin.last("room_state")!!["round"]["clues"].size())

            admin.send("skip_discussion")
            players.forEach { it.awaitPhase("VOTING", round) }

            val promptsBefore = players.associate { it.id to it.all("guess_prompt").size }
            for (player in players) {
                val target = if (player.id == imposterId) players.first { it.id != imposterId }.id else imposterId
                player.send("vote", mapOf("targetIds" to listOf(target)))
            }
            players.forEach { it.awaitPhase("GUESS", round) }
            imposter.awaitCount("guess_prompt", promptsBefore.getValue(imposterId) + 1)
            players.filter { it !== imposter }.forEach {
                assertEquals(promptsBefore.getValue(it.id), it.all("guess_prompt").size, "only the caught imposter is prompted")
            }

            imposter.send("guess", mapOf("text" to word.uppercase()))
            for (player in players) {
                val result = player.await("round_result") { it["roundNumber"].asInt() == round }
                assertEquals(listOf(imposterId), result["caughtIds"].map { it.asText() })
                assertEquals(word, result["word"].asText())
                assertTrue(result["guesses"][imposterId]["correct"].asBoolean())
                players.forEach { assertEquals(1, result["points"][it.id].asInt()) }
            }
            players.forEach { it.awaitPhase("RESULTS", round) }
        }

        admin.send("next_round")
        for (player in players) {
            val final = player.await("final_result")
            assertEquals(4, final["leaderboard"].size())
            final["leaderboard"].forEach { assertEquals(2, it["score"].asInt()) }
            assertTrue(final["awards"].any { it["type"].asText() == "MIND_READER" })
            player.awaitState { it["phase"].asText() == "FINAL" }
        }

        // Nothing broadcast to everyone ever contained a secret word.
        for (player in players) {
            val states = player.raw.filter { it.startsWith("""{"type":"room_state"""") }
            assertTrue(states.isNotEmpty())
            words.forEach { word -> assertFalse(states.any { it.contains(word) }, "room_state leaked $word") }
        }

        admin.send("play_again")
        players.forEach { p ->
            p.awaitState { s -> s["phase"].asText() == "LOBBY" && s["players"].all { it["score"].asInt() == 0 } }
        }
    }
}

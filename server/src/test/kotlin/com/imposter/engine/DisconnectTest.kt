package com.imposter.engine

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DisconnectTest {
    private fun Harness.toClues() {
        startGame()
        allReady()
    }

    @Test
    fun `a brief drop during your turn doesn't end it`() {
        val h = Harness(4)
        h.toClues()
        val order = h.round.turnOrder
        h.send(Event.Disconnected(order[0]))
        assertEquals(order[0], h.round.currentPlayerId, "the turn keeps running")
        assertTrue(h.round.clues.isEmpty())

        h.elapse(3_000)
        h.send(Event.Connected(order[0]))
        h.send(Event.SubmitClue(order[0], "back in time"))
        assertEquals(Clue(order[0], "back in time", skipped = false, durationMs = 3_000), h.round.clues.single())
    }

    @Test
    fun `current player who stays away is skipped when the turn times out`() {
        val h = Harness(4)
        h.toClues()
        val order = h.round.turnOrder
        h.send(Event.Disconnected(order[0]))
        h.expire()
        assertEquals(Clue(order[0], null, skipped = true), h.round.clues.single())
        assertEquals(order[1], h.round.currentPlayerId)
    }

    @Test
    fun `away player's turn is skipped when it comes up`() {
        val h = Harness(4)
        h.toClues()
        val order = h.round.turnOrder
        h.send(Event.Disconnected(order[2]))
        h.send(Event.EndTurn(order[0]))
        h.send(Event.EndTurn(order[1]))
        assertEquals(order[3], h.round.currentPlayerId)
        assertTrue(h.round.clues[2].skipped)
    }

    @Test
    fun `reveal waits for a player whose connection dropped, until the timer`() {
        val h = Harness(4)
        h.startGame()
        h.send(Event.Disconnected("p4"))
        listOf("p1", "p2", "p3").forEach { h.send(Event.Ready(it)) }
        assertEquals(Phase.REVEAL, h.room.phase, "p4 may just have locked their screen")

        h.send(Event.Connected("p4"))
        h.send(Event.Ready("p4"))
        assertEquals(Phase.CLUES, h.room.phase)
    }

    @Test
    fun `reveal ends at 30s if a dropped player never comes back`() {
        val h = Harness(4)
        h.startGame()
        h.send(Event.Disconnected("p4"))
        listOf("p1", "p2", "p3").forEach { h.send(Event.Ready(it)) }
        h.elapse(Rules.REVEAL_MS)
        assertEquals(Phase.CLUES, h.room.phase)
    }

    @Test
    fun `disconnected players abstain from voting`() {
        val h = Harness(4)
        h.toVoting()
        h.send(Event.Vote("p1", listOf("p2")))
        h.send(Event.Vote("p2", listOf("p1")))
        h.send(Event.Vote("p3", listOf("p2")))
        assertEquals(Phase.VOTING, h.room.phase)
        h.send(Event.Disconnected("p4"))
        assertEquals(Phase.VOTING, h.room.phase, "a dropped voter still gets until the timer")
        h.elapse(Rules.VOTE_MS)
        assertEquals(setOf("p2"), h.round.caughtIds)
    }

    @Test
    fun `caught imposter who is away forfeits the guess`() {
        val h = Harness(4)
        h.toVoting()
        val imposter = h.imposters.single()
        h.send(Event.Vote(imposter, listOf(h.crew.first())))
        h.crew.forEach { h.send(Event.Vote(it, listOf(imposter))) }
        h.send(Event.Disconnected(imposter))
        assertEquals(Phase.GUESS, h.room.phase, "they may be back in time")
        h.elapse(Rules.GUESS_MS)
        assertEquals(Phase.RESULTS, h.room.phase)
        assertEquals(0, h.room.lastResult!!.points[imposter])
    }

    @Test
    fun `reconnecting within the grace period keeps the seat and resends the role`() {
        val h = Harness(4)
        h.startGame()
        h.send(Event.Disconnected("p2"))
        h.elapse(30_000)
        val effects = h.send(Event.Connected("p2"))
        assertTrue(Effect.SendState("p2") in effects)
        assertTrue(effects.any { it is Effect.SendRole && it.playerId == "p2" })
        h.elapse(60_000) // the old grace timer fires and is ignored
        assertTrue("p2" in h.room.players)
        assertTrue(h.room.players.getValue("p2").connected)
    }

    @Test
    fun `rejoining during results resends the round result`() {
        val h = Harness(4)
        h.startGame()
        h.playRound { it.imposterIds }
        h.send(Event.Disconnected("p3"))
        val effects = h.send(Event.Connected("p3"))
        assertTrue(effects.any { it is Effect.SendRoundResult && it.to == Recipient.One("p3") })
    }

    @Test
    fun `seat is released after 60s away`() {
        val h = Harness(4)
        h.send(Event.Disconnected("p3"))
        h.elapse(Rules.GRACE_MS - 1)
        assertTrue("p3" in h.room.players)
        h.elapse(1)
        assertFalse("p3" in h.room.players)
    }

    @Test
    fun `players who join but never connect lose the seat`() {
        val h = Harness(3)
        h.send(Event.Join("p9", "t", "Ghost", 0))
        h.elapse(Rules.GRACE_MS)
        assertFalse("p9" in h.room.players)
    }

    @Test
    fun `admin passes to the longest-connected player after the grace period`() {
        val h = Harness(4)
        h.send(Event.Disconnected("p3"))
        h.elapse(10_000)
        h.send(Event.Connected("p3"))
        h.send(Event.Disconnected("p2"))
        h.elapse(10_000)
        h.send(Event.Connected("p2"))
        // p4 has now been connected the longest.

        h.send(Event.Disconnected("p1"))
        h.elapse(Rules.GRACE_MS - 1)
        assertEquals("p1", h.room.adminId, "admin keeps the role during the grace period")
        h.elapse(1)
        assertEquals("p4", h.room.adminId)
    }

    @Test
    fun `admin leaving mid-round passes admin and the round continues`() {
        val h = Harness(4, SettingsPatch(discussionSeconds = 300))
        h.startGame()
        h.allReady()
        h.playAllTurns()
        h.send(Event.Disconnected("p1"))
        h.elapse(Rules.GRACE_MS)
        assertEquals(Phase.DISCUSSION, h.room.phase)
        assertTrue(h.room.adminId != "p1")
        h.send(Event.SkipDiscussion(h.room.adminId))
        assertEquals(Phase.VOTING, h.room.phase)
    }

    @Test
    fun `dropping under 3 players mid-game cancels the round`() {
        val h = Harness(3)
        h.startGame()
        h.allReady()
        h.send(Event.Disconnected("p3"))
        h.elapse(Rules.GRACE_MS)
        assertEquals(Phase.LOBBY, h.room.phase)
        assertNull(h.room.round)
        assertNull(h.room.endsAt)
        assertTrue(h.room.scores.isEmpty())
    }

    @Test
    fun `empty room is deleted after 10 minutes`() {
        val h = Harness(3)
        h.ids.forEach { h.send(Event.Disconnected(it)) }
        h.elapse(Rules.GRACE_MS)
        assertTrue(h.room.players.isEmpty())
        h.elapse(Rules.EMPTY_ROOM_MS - 1)
        assertTrue(Effect.DeleteRoom !in h.allEffects)
        h.elapse(1)
        assertTrue(Effect.DeleteRoom in h.allEffects)
    }

    @Test
    fun `someone joining an empty room saves it from cleanup`() {
        val h = Harness(3)
        h.ids.forEach { h.send(Event.Disconnected(it)) }
        h.elapse(Rules.GRACE_MS)
        h.send(Event.Join("p9", "t", "Saviour", 0))
        h.send(Event.Connected("p9"))
        h.elapse(Rules.EMPTY_ROOM_MS)
        assertTrue(Effect.DeleteRoom !in h.allEffects)
    }

    @Test
    fun `leaving frees the seat at once and passes admin`() {
        val h = Harness(4)
        h.send(Event.Leave("p1"))
        assertFalse("p1" in h.room.players)
        assertEquals("p2", h.admin)
        h.send(Event.Leave("p1"))
        assertTrue(h.errors().isEmpty(), "leaving twice is harmless")
    }

    @Test
    fun `leaving mid-round under 3 players cancels the round`() {
        val h = Harness(3)
        h.toClues()
        h.send(Event.Leave(h.round.turnOrder[1]))
        assertEquals(Phase.LOBBY, h.room.phase)
    }
}

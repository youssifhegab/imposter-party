package com.imposter.engine

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals

/** Phones report the words they played recently, so a new party with the same friends gets fresh words. */
class RecentWordsTest {
    // In Fixtures, English food words are ids 1–4: Pizza, Burger, Sushi, Falafel.
    private fun foodHarness() = Harness(3, SettingsPatch(category = "food"))

    @Test
    fun `words any player saw recently are avoided`() {
        val h = foodHarness()
        h.send(Event.Connected("p2", recentWordIds = listOf(1, 2)))
        h.send(Event.Connected("p3", recentWordIds = listOf(3)))
        h.startGame()
        assertEquals("Falafel", h.round.word)
    }

    @Test
    fun `when everything is recent, words still come, without repeating within the party`() {
        val h = foodHarness()
        h.send(Event.Connected("p1", recentWordIds = listOf(1, 2, 3, 4)))
        h.startGame()
        val first = h.round.word
        h.playRound { it.imposterIds }
        h.send(Event.NextRound(h.admin))
        assertNotEquals(first, h.round.word, "this party's own words are still avoided")
    }

    @Test
    fun `a phone reports at most 300 ids, newest kept`() {
        val h = foodHarness()
        h.send(Event.Connected("p1", recentWordIds = (1..1000).toList()))
        val stored = h.room.players.getValue("p1").recentWordIds
        assertEquals(Rules.MAX_RECENT_WORDS, stored.size)
        assertEquals((701..1000).toSet(), stored)
    }

    @Test
    fun `reconnecting without a list keeps the one we had`() {
        val h = foodHarness()
        h.send(Event.Connected("p1", recentWordIds = listOf(1)))
        h.send(Event.Disconnected("p1"))
        h.send(Event.Connected("p1"))
        assertEquals(setOf(1), h.room.players.getValue("p1").recentWordIds)
    }

    @Test
    fun `the round result says which word it was`() {
        val h = foodHarness()
        h.startGame()
        val id = h.round.wordId
        h.playRound { it.imposterIds }
        assertEquals(id, h.room.lastResult!!.wordId)
    }
}

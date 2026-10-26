package com.imposter.engine

import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class VotingTest {
    @Nested
    inner class Tallying {
        @Test
        fun `clear winner is caught`() {
            val votes = mapOf("a" to listOf("x"), "b" to listOf("x"), "c" to listOf("y"))
            assertEquals(Tally.Decided(setOf("x")), Voting.tally(votes, 1))
        }

        @Test
        fun `tie for the only slot needs a revote`() {
            val votes = mapOf("a" to listOf("x"), "b" to listOf("y"), "c" to listOf("x"), "d" to listOf("y"))
            assertEquals(Tally.Tie(locked = emptySet(), tied = setOf("x", "y"), slots = 1), Voting.tally(votes, 1))
        }

        @Test
        fun `tie entirely inside the top N is not a tie`() {
            val votes = mapOf("a" to listOf("x", "y"), "b" to listOf("x", "y"), "c" to listOf("z", "x"), "d" to listOf("y", "a"))
            // x=3, y=3, z=1, a=1 with 2 slots
            assertEquals(Tally.Decided(setOf("x", "y")), Voting.tally(votes, 2))
        }

        @Test
        fun `tie at the cutoff locks in players above it`() {
            val votes = mapOf("a" to listOf("x", "y"), "b" to listOf("x", "z"), "c" to listOf("x", "y"), "d" to listOf("z", "a"))
            // x=3, y=2, z=2, a=1 with 2 slots
            assertEquals(Tally.Tie(locked = setOf("x"), tied = setOf("y", "z"), slots = 1), Voting.tally(votes, 2))
        }

        @Test
        fun `fewer voted-for players than slots catches all of them`() {
            assertEquals(Tally.Decided(setOf("x")), Voting.tally(mapOf("a" to listOf("x")), 2))
        }

        @Test
        fun `everyone abstaining catches nobody`() {
            assertEquals(Tally.Decided(emptySet()), Voting.tally(emptyMap(), 1))
        }

        @Test
        fun `three-way tie for one slot`() {
            val votes = mapOf("a" to listOf("b"), "b" to listOf("c"), "c" to listOf("a"))
            assertEquals(Tally.Tie(emptySet(), setOf("a", "b", "c"), 1), Voting.tally(votes, 1))
        }
    }

    @Test
    fun `ballots must name exactly N other players`() {
        val h = Harness(4)
        h.toVoting()
        h.send(Event.Vote("p1", listOf("p1")))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors(), "self vote")
        h.send(Event.Vote("p1", listOf("p2", "p3")))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors(), "too many")
        h.send(Event.Vote("p1", emptyList()))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors(), "too few")
        h.send(Event.Vote("p1", listOf("ghost")))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors(), "unknown target")
        h.send(Event.Vote("p1", listOf("p2")))
        assertTrue(h.errors().isEmpty())
        h.send(Event.Vote("p1", listOf("p3")))
        assertEquals(listOf(ErrorCode.ALREADY_DONE), h.errors(), "double vote")
    }

    @Test
    fun `votes stay hidden until voting ends but progress is tracked`() {
        val h = Harness(4)
        h.toVoting()
        h.send(Event.Vote("p1", listOf("p2")))
        assertEquals(setOf("p1"), h.round.votes.keys)
        assertTrue(h.lastEffects.none { it is Effect.SendRoundResult })
    }

    @Test
    fun `tie triggers one revote among tied players, which can resolve it`() {
        val h = Harness(4)
        h.toVoting()
        h.send(Event.Vote("p1", listOf("p2")))
        h.send(Event.Vote("p2", listOf("p1")))
        h.send(Event.Vote("p3", listOf("p1")))
        h.send(Event.Vote("p4", listOf("p2")))
        assertEquals(Phase.REVOTE, h.room.phase)
        assertEquals(setOf("p1", "p2"), h.round.revoteCandidates)
        assertEquals(1, h.round.revoteSlots)
        assertEquals(h.now + Rules.REVOTE_MS, h.room.endsAt)

        assertEquals(setOf("p3", "p4"), h.round.revoteVoterIds, "tied players sit out")

        h.send(Event.Vote("p3", listOf("p4")))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors(), "only tied players can be voted for")
        h.send(Event.Vote("p1", listOf("p2")))
        assertEquals(listOf(ErrorCode.NOT_ALLOWED), h.errors(), "tied players don't vote in the revote")

        h.send(Event.Vote("p3", listOf("p1")))
        h.send(Event.Vote("p4", listOf("p1")))
        assertEquals(setOf("p1"), h.round.caughtIds)
        assertTrue(h.room.phase == Phase.GUESS || h.room.phase == Phase.RESULTS)
    }

    @Test
    fun `tie that survives the revote catches nobody from the tie`() {
        val h = Harness(4)
        h.toVoting()
        h.send(Event.Vote("p1", listOf("p2")))
        h.send(Event.Vote("p2", listOf("p1")))
        h.send(Event.Vote("p3", listOf("p1")))
        h.send(Event.Vote("p4", listOf("p2")))
        h.send(Event.Vote("p3", listOf("p2")))
        h.send(Event.Vote("p4", listOf("p1")))

        assertEquals(Phase.RESULTS, h.room.phase)
        assertEquals(emptySet(), h.round.caughtIds)
        assertEquals(2, h.room.lastResult!!.points[h.imposters.single()])
        assertTrue(h.room.lastResult!!.revotes!!.isNotEmpty())
    }

    @Test
    fun `revote times out after 20s`() {
        val h = Harness(4)
        h.toVoting()
        h.send(Event.Vote("p1", listOf("p2")))
        h.send(Event.Vote("p2", listOf("p1")))
        h.send(Event.Vote("p3", listOf("p1")))
        h.send(Event.Vote("p4", listOf("p2")))
        h.send(Event.Vote("p3", listOf("p2")))
        h.elapse(Rules.REVOTE_MS)
        assertEquals(setOf("p2"), h.round.caughtIds)
    }

    @Test
    fun `multi-imposter vote with a tie for the last slot`() {
        val h = Harness(6, SettingsPatch(imposterCount = 2))
        h.toVoting()
        assertEquals(2, h.imposters.size)
        h.send(Event.Vote("p1", listOf("p2")))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors(), "must pick 2")

        h.send(Event.Vote("p1", listOf("p2", "p3")))
        h.send(Event.Vote("p2", listOf("p1", "p3")))
        h.send(Event.Vote("p3", listOf("p1", "p2")))
        h.send(Event.Vote("p4", listOf("p1", "p2")))
        h.send(Event.Vote("p5", listOf("p1", "p3")))
        h.send(Event.Vote("p6", listOf("p4", "p5")))
        // p1=4, p2=3, p3=3: p1 is in, p2 and p3 fight for the second slot.
        assertEquals(Phase.REVOTE, h.room.phase)
        assertEquals(setOf("p1"), h.round.lockedIds)
        assertEquals(setOf("p2", "p3"), h.round.revoteCandidates)
        assertEquals(1, h.round.revoteSlots)

        assertEquals(setOf("p1", "p4", "p5", "p6"), h.round.revoteVoterIds, "the locked-in p1 still votes")
        h.send(Event.Vote("p1", listOf("p2")))
        h.send(Event.Vote("p4", listOf("p2")))
        h.send(Event.Vote("p5", listOf("p2")))
        h.send(Event.Vote("p6", listOf("p3")))
        assertEquals(setOf("p1", "p2"), h.round.caughtIds)
    }

    @Test
    fun `with three players a two-way tie is settled by the third`() {
        val h = Harness(3)
        h.toVoting()
        h.send(Event.Vote("p1", listOf("p2")))
        h.send(Event.Vote("p2", listOf("p1")))
        h.expire() // p3 never votes
        assertEquals(Phase.REVOTE, h.room.phase)
        assertEquals(setOf("p3"), h.round.revoteVoterIds)

        // The revote ends as soon as the only voter has voted.
        h.send(Event.Vote("p3", listOf("p2")))
        assertEquals(setOf("p2"), h.round.caughtIds)
    }

    @Test
    fun `when everyone is tied everyone votes again`() {
        val h = Harness(3)
        h.toVoting()
        h.send(Event.Vote("p1", listOf("p2")))
        h.send(Event.Vote("p2", listOf("p3")))
        h.send(Event.Vote("p3", listOf("p1")))
        assertEquals(Phase.REVOTE, h.room.phase)
        assertEquals(setOf("p1", "p2", "p3"), h.round.revoteCandidates)
        assertEquals(setOf("p1", "p2", "p3"), h.round.revoteVoterIds)

        h.send(Event.Vote("p1", listOf("p3")))
        h.send(Event.Vote("p2", listOf("p3")))
        h.send(Event.Vote("p3", listOf("p1")))
        assertEquals(setOf("p3"), h.round.caughtIds)
    }

    @Test
    fun `multi-imposter vote catching both imposters`() {
        val h = Harness(6, SettingsPatch(imposterCount = 2))
        h.toVoting()
        h.everyoneVotesFor(h.imposters)
        assertEquals(h.imposters, h.round.caughtIds)
        assertEquals(Phase.GUESS, h.room.phase)

        val (a, b) = h.imposters.toList()
        h.send(Event.Guess(a, h.round.word))
        assertEquals(Phase.GUESS, h.room.phase, "waits for every caught imposter")
        h.send(Event.Guess(a, "again"))
        assertEquals(listOf(ErrorCode.ALREADY_DONE), h.errors())
        h.send(Event.Guess(b, "wrong"))
        assertEquals(Phase.RESULTS, h.room.phase)

        val points = h.room.lastResult!!.points
        assertEquals(1, points[a])
        assertEquals(0, points[b])
        h.crew.forEach { assertEquals(2, points[it]) }
    }
}

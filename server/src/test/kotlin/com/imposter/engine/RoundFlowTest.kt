package com.imposter.engine

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RoundFlowTest {
    @Test
    fun `with 3 clue rounds the turn order goes around three times for the same word`() {
        val h = Harness(3, SettingsPatch(clueRounds = 3))
        h.startGame()
        h.allReady()
        val order = h.round.turnOrder
        val word = h.round.word

        for (turn in 0 until 9) {
            assertEquals(Phase.CLUES, h.room.phase)
            assertEquals(order[turn % 3], h.round.currentPlayerId)
            assertEquals(turn / 3 + 1, h.round.clueRound)
            h.send(Event.SubmitClue(h.round.currentPlayerId!!, "clue $turn"))
        }
        assertEquals(Phase.DISCUSSION, h.room.phase, "discussion only after the last clue round")
        assertEquals(word, h.round.word)
        assertEquals((0 until 9).map { "clue $it" }, h.round.clues.map { it.text })
        assertEquals(List(3) { order }.flatten(), h.round.clues.map { it.playerId })
    }

    @Test
    fun `an away player is skipped in each clue round`() {
        val h = Harness(4, SettingsPatch(clueRounds = 2))
        h.startGame()
        h.allReady()
        val order = h.round.turnOrder
        h.send(Event.Disconnected(order[2]))
        h.playAllTurns()
        assertEquals(Phase.DISCUSSION, h.room.phase)
        assertEquals(8, h.round.clues.size)
        assertEquals(listOf(2, 6), h.round.clues.withIndex().filter { it.value.skipped }.map { it.index })
    }

    @Test
    fun `starting deals roles privately and enters reveal`() {
        val h = Harness(4)
        h.startGame()
        assertEquals(Phase.REVEAL, h.room.phase)
        assertEquals(h.now + Rules.REVEAL_MS, h.room.endsAt)
        assertEquals(1, h.imposters.size)

        val roles = h.lastEffects.filterIsInstance<Effect.SendRole>()
        assertEquals(h.ids.toSet(), roles.map { it.playerId }.toSet())
        for (sent in roles) {
            assertEquals(Fixtures.bank.categoryName(h.round.category, Lang.EN), sent.role.categoryName)
            if (sent.playerId in h.imposters) {
                assertTrue(sent.role.isImposter)
                assertNull(sent.role.word)
                assertNull(sent.role.fellowImposterIds)
            } else {
                assertEquals(h.round.word, sent.role.word)
            }
        }
        assertEquals(Effect.BroadcastState, h.lastEffects.last())
    }

    @Test
    fun `imposters see each other only when enabled`() {
        val h = Harness(5, SettingsPatch(imposterCount = 2, impostersKnowEachOther = true))
        h.startGame()
        val roles = h.lastEffects.filterIsInstance<Effect.SendRole>().associate { it.playerId to it.role }
        val (a, b) = h.imposters.toList()
        assertEquals(listOf(b), roles.getValue(a).fellowImposterIds)
        assertEquals(listOf(a), roles.getValue(b).fellowImposterIds)
        h.crew.forEach { assertNull(roles.getValue(it).fellowImposterIds) }
    }

    @Test
    fun `reveal ends once everyone is ready`() {
        val h = Harness(4)
        h.startGame()
        h.send(Event.Ready("p1"))
        assertEquals(Phase.REVEAL, h.room.phase)
        h.allReady()
        assertEquals(Phase.CLUES, h.room.phase)
    }

    @Test
    fun `reveal ends after 30s even if some are not ready`() {
        val h = Harness(4)
        h.startGame()
        h.send(Event.Ready("p1"))
        h.elapse(Rules.REVEAL_MS - 1)
        assertEquals(Phase.REVEAL, h.room.phase)
        h.elapse(1)
        assertEquals(Phase.CLUES, h.room.phase)
    }

    @Test
    fun `clue turns advance on submit, done, and timeout`() {
        val h = Harness(4, SettingsPatch(turnSeconds = 20))
        h.startGame()
        h.allReady()
        val order = h.round.turnOrder
        assertEquals(order[0], h.round.currentPlayerId)
        assertEquals(h.now + 20_000, h.room.endsAt)

        h.elapse(3_000)
        h.send(Event.SubmitClue(order[0], "  very   cheesy "))
        assertEquals(order[1], h.round.currentPlayerId)
        h.send(Event.EndTurn(order[1]))
        assertEquals(order[2], h.round.currentPlayerId)
        h.expire()
        assertEquals(order[3], h.round.currentPlayerId)

        assertEquals(
            listOf(
                Clue(order[0], "very cheesy", skipped = false, durationMs = 3_000),
                Clue(order[1], null, skipped = false, durationMs = 0),
                Clue(order[2], null, skipped = true),
            ),
            h.round.clues,
        )
    }

    @Test
    fun `only the current player can give a clue, and clues are at most 30 characters`() {
        val h = Harness(4)
        h.startGame()
        h.allReady()
        val current = h.round.currentPlayerId!!
        val other = h.round.turnOrder[1]
        h.send(Event.SubmitClue(other, "hi"))
        assertEquals(listOf(ErrorCode.NOT_YOUR_TURN), h.errors())
        h.send(Event.EndTurn(other))
        assertEquals(listOf(ErrorCode.NOT_YOUR_TURN), h.errors())
        h.send(Event.SubmitClue(current, "x".repeat(31)))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors())
        h.send(Event.SubmitClue(current, "   "))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors())
        assertEquals(current, h.round.currentPlayerId)
    }

    @Test
    fun `last turn starts discussion, which ends on its timer`() {
        val h = Harness(3, SettingsPatch(discussionSeconds = 45))
        h.startGame()
        h.allReady()
        h.playAllTurns()
        assertEquals(Phase.DISCUSSION, h.room.phase)
        assertEquals(h.now + 45_000, h.room.endsAt)
        h.expire()
        assertEquals(Phase.VOTING, h.room.phase)
        assertEquals(h.now + Rules.VOTE_MS, h.room.endsAt)
    }

    @Test
    fun `only the admin can skip discussion`() {
        val h = Harness(3)
        h.startGame()
        h.allReady()
        h.playAllTurns()
        h.send(Event.SkipDiscussion("p2"))
        assertEquals(listOf(ErrorCode.NOT_ADMIN), h.errors())
        h.send(Event.SkipDiscussion("p1"))
        assertEquals(Phase.VOTING, h.room.phase)
    }

    @Test
    fun `stale timers from an earlier phase are ignored`() {
        val h = Harness(3)
        h.startGame()
        h.allReady() // the 30s reveal timer is still scheduled
        h.playAllTurns()
        h.send(Event.SkipDiscussion(h.admin))
        assertEquals(Phase.VOTING, h.room.phase)
        h.send(Event.TimerFired(TimerKey.PhaseTimer(1)))
        assertEquals(Phase.VOTING, h.room.phase)
    }

    @Test
    fun `nobody caught goes straight to results and imposter scores 2`() {
        val h = Harness(4)
        h.startGame()
        val innocent = h.crew.first()
        h.playRound { setOf(innocent) }
        assertEquals(Phase.RESULTS, h.room.phase)
        assertNull(h.room.endsAt)
        assertEquals(setOf(innocent), h.round.caughtIds)

        val result = h.lastEffects.filterIsInstance<Effect.SendRoundResult>().single().result
        assertEquals(Recipient.All, h.lastEffects.filterIsInstance<Effect.SendRoundResult>().single().to)
        assertEquals(h.round.word, result.word)
        assertEquals(h.imposters, result.imposterIds)
        val imposter = h.imposters.single()
        assertEquals(2, result.points[imposter])
        h.crew.forEach { assertEquals(0, result.points[it]) }
        assertEquals(2, h.room.scores[imposter])
    }

    @Test
    fun `caught imposter guesses the word for 1 point`() {
        val h = Harness(4)
        h.toVoting()
        val imposter = h.imposters.single()
        h.everyoneVotesFor(h.imposters)
        assertEquals(Phase.GUESS, h.room.phase)
        assertEquals(h.now + Rules.GUESS_MS, h.room.endsAt)

        h.send(Event.Guess(h.crew.first(), "anything"))
        assertEquals(listOf(ErrorCode.NOT_ALLOWED), h.errors())

        h.send(Event.Guess(imposter, h.round.word.lowercase()))
        assertEquals(Phase.RESULTS, h.room.phase)
        val result = h.room.lastResult!!
        assertTrue(result.guesses.getValue(imposter).correct)
        assertEquals(1, result.points[imposter])
        h.crew.forEach { assertEquals(1, result.points[it]) }
    }

    @Test
    fun `only caught imposters are prompted to guess, including after a rejoin`() {
        val h = Harness(6, SettingsPatch(imposterCount = 2))
        h.toVoting()
        val (caught, free) = h.imposters.toList()
        h.everyoneVotesFor(listOf(caught, h.crew.first()))
        assertEquals(Phase.GUESS, h.room.phase)
        assertEquals(listOf(Effect.PromptGuess(caught)), h.lastEffects.filterIsInstance<Effect.PromptGuess>())

        h.send(Event.Disconnected(free))
        val effects = h.send(Event.Connected(free))
        assertTrue(effects.none { it is Effect.PromptGuess })
    }

    @Test
    fun `guess phase times out with no guess`() {
        val h = Harness(4)
        h.toVoting()
        h.everyoneVotesFor(h.imposters)
        h.expire()
        assertEquals(Phase.RESULTS, h.room.phase)
        assertEquals(0, h.room.lastResult!!.points[h.imposters.single()])
    }

    @Test
    fun `voting times out and missing voters abstain`() {
        val h = Harness(4)
        h.toVoting()
        val imposter = h.imposters.single()
        h.crew.take(2).forEach { h.send(Event.Vote(it, listOf(imposter))) }
        h.expire()
        assertEquals(setOf(imposter), h.round.caughtIds)
        assertEquals(Phase.GUESS, h.room.phase)
    }

    @Test
    fun `next round deals a new word, the last round ends the game, play again resets`() {
        val h = Harness(4, SettingsPatch(rounds = 2))
        h.startGame()
        h.playRound { it.imposterIds }
        val firstWord = h.round.wordId

        h.send(Event.NextRound("p2"))
        assertEquals(listOf(ErrorCode.NOT_ADMIN), h.errors())
        h.send(Event.NextRound(h.admin))
        assertEquals(Phase.REVEAL, h.room.phase)
        assertEquals(2, h.round.number)
        assertNotEquals(firstWord, h.round.wordId)
        assertTrue(h.lastEffects.any { it is Effect.SendRole })

        h.playRound { it.imposterIds }
        h.send(Event.NextRound(h.admin))
        assertEquals(Phase.FINAL, h.room.phase)
        val final = h.lastEffects.filterIsInstance<Effect.SendFinalResult>().single().result
        assertEquals(4, final.leaderboard.size)
        assertEquals(h.room.scores.values.max(), final.leaderboard.first().score)

        h.send(Event.PlayAgain(h.admin))
        assertEquals(Phase.LOBBY, h.room.phase)
        assertNull(h.room.round)
        assertTrue(h.room.scores.isEmpty())
        assertEquals(2, h.room.settings.rounds)
    }

    @Test
    fun `scores accumulate across rounds and reset on a new game`() {
        val h = Harness(4, SettingsPatch(rounds = 2))
        h.startGame()
        h.playRound { setOf(it.participantIds.first { id -> id !in it.imposterIds }) }
        val afterOne = h.room.scores
        h.send(Event.NextRound(h.admin))
        h.playRound { setOf(it.participantIds.first { id -> id !in it.imposterIds }) }
        h.ids.forEach { assertTrue(h.room.scores.getValue(it) >= afterOne.getValue(it)) }
        assertEquals(4, h.room.scores.values.sum()) // two imposters survived, 2 points each
    }

    @Test
    fun `words never repeat and random category changes every round`() {
        val h = Harness(4, SettingsPatch(rounds = 6))
        h.startGame()
        val rounds = mutableListOf<Round>()
        repeat(6) {
            rounds += h.round
            h.playRound { setOf(it.participantIds.first { id -> id !in it.imposterIds }) }
            h.send(Event.NextRound(h.admin))
        }
        assertEquals(6, rounds.map { it.wordId }.toSet().size)
        rounds.zipWithNext().forEach { (a, b) -> assertNotEquals(a.category, b.category) }
        assertEquals(6, h.room.usedWordIds.size)
    }

    @Test
    fun `words stay unique across games in the same party`() {
        val h = Harness(3, SettingsPatch(rounds = 2, category = "food"))
        val seen = mutableListOf<Int>()
        repeat(2) {
            h.startGame()
            repeat(2) {
                seen += h.round.wordId
                h.playRound { setOf(it.participantIds.first { id -> id !in it.imposterIds }) }
                h.send(Event.NextRound(h.admin))
            }
            h.send(Event.PlayAgain(h.admin))
        }
        assertEquals(4, seen.toSet().size)
    }

    @Test
    fun `starting player changes every round`() {
        val h = Harness(4, SettingsPatch(rounds = 6))
        h.startGame()
        val starters = mutableListOf<String>()
        repeat(6) {
            starters += h.round.turnOrder.first()
            h.playRound { setOf(it.participantIds.first { id -> id !in it.imposterIds }) }
            h.send(Event.NextRound(h.admin))
        }
        starters.zipWithNext().forEach { (a, b) -> assertNotEquals(a, b) }
    }

    @Test
    fun `actions in the wrong phase are rejected`() {
        val h = Harness(3)
        h.send(Event.Vote("p1", listOf("p2")))
        assertEquals(listOf(ErrorCode.WRONG_PHASE), h.errors())
        h.send(Event.Guess("p1", "x"))
        assertEquals(listOf(ErrorCode.WRONG_PHASE), h.errors())
        h.send(Event.NextRound("p1"))
        assertEquals(listOf(ErrorCode.WRONG_PHASE), h.errors())
        h.send(Event.PlayAgain("p1"))
        assertEquals(listOf(ErrorCode.WRONG_PHASE), h.errors())
    }
}

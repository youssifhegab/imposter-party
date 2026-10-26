package com.imposter.engine

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class ScoringAndAwardsTest {
    private fun round(
        imposters: Set<String>,
        caught: Set<String> = emptySet(),
        guesses: Map<String, GuessAttempt> = emptyMap(),
        votes: Map<String, List<String>> = emptyMap(),
        clues: List<Clue> = emptyList(),
    ) = Round(
        number = 1,
        category = "food",
        wordId = 1,
        word = "Pizza",
        imposterIds = imposters,
        participantIds = listOf("a", "b", "c", "d", "e"),
        turnOrder = listOf("a", "b", "c", "d", "e"),
        caughtIds = caught,
        guesses = guesses,
        votes = votes,
        clues = clues,
    )

    private val everyone = listOf("a", "b", "c", "d", "e")

    @Test
    fun `uncaught imposter scores 2 and crew scores nothing`() {
        assertEquals(
            mapOf("a" to 2, "b" to 0, "c" to 0, "d" to 0, "e" to 0),
            Scoring.roundPoints(round(setOf("a"), caught = setOf("b")), everyone),
        )
    }

    @Test
    fun `caught imposter scores 1 for a correct guess and 0 otherwise`() {
        val right = round(setOf("a"), caught = setOf("a"), guesses = mapOf("a" to GuessAttempt("pizza", true)))
        assertEquals(1, Scoring.roundPoints(right, everyone)["a"])
        val wrong = round(setOf("a"), caught = setOf("a"), guesses = mapOf("a" to GuessAttempt("pasta", false)))
        assertEquals(0, Scoring.roundPoints(wrong, everyone)["a"])
    }

    @Test
    fun `crew score 1 per caught imposter`() {
        val r = round(setOf("a", "b"), caught = setOf("a", "b"))
        assertEquals(mapOf("a" to 0, "b" to 0, "c" to 2, "d" to 2, "e" to 2), Scoring.roundPoints(r, everyone))

        val one = round(setOf("a", "b"), caught = setOf("a", "c"))
        assertEquals(mapOf("a" to 0, "b" to 2, "c" to 1, "d" to 1, "e" to 1), Scoring.roundPoints(one, everyone))
    }

    @Test
    fun `leaderboard ranks ties together`() {
        assertEquals(
            listOf(
                LeaderboardEntry("b", 5, 1),
                LeaderboardEntry("c", 5, 1),
                LeaderboardEntry("a", 3, 3),
                LeaderboardEntry("d", 0, 4),
            ),
            Scoring.leaderboard(mapOf("a" to 3, "b" to 5, "c" to 5, "d" to 0)),
        )
    }

    @Test
    fun `stats track votes, survival, guesses, clue speed, and streaks`() {
        val r1 = round(
            imposters = setOf("a"),
            caught = setOf("a"),
            guesses = mapOf("a" to GuessAttempt("pizza", true)),
            votes = mapOf("b" to listOf("a"), "c" to listOf("a"), "d" to listOf("b"), "e" to listOf("b"), "a" to listOf("b")),
            clues = listOf(Clue("a", "x", false, 4_000), Clue("b", null, false, 2_000), Clue("c", null, true)),
        )
        val r2 = round(imposters = setOf("b"), votes = mapOf("c" to listOf("d"), "d" to listOf("c")))

        val stats = Awards.updateStats(Awards.updateStats(emptyMap(), r1, everyone), r2, everyone)
        assertEquals(1, stats.getValue("a").correctGuesses)
        assertEquals(0, stats.getValue("a").survivedAsImposter)
        assertEquals(1, stats.getValue("b").survivedAsImposter)
        assertEquals(1, stats.getValue("c").correctVotes)
        assertEquals(0, stats.getValue("c").catchStreak, "streak resets on a miss")
        assertEquals(1, stats.getValue("c").bestCatchStreak)
        assertEquals(3, stats.getValue("b").votesReceivedAsCrew, "only counted while crew")
        assertEquals(1, stats.getValue("a").clueCount)
        assertEquals(0, stats.getValue("c").clueCount, "skipped turns don't count")
    }

    @Test
    fun `awards go to the best player and ties share`() {
        val stats = mapOf(
            "a" to PlayerStats(survivedAsImposter = 2, correctVotes = 1, clueCount = 2, clueMsTotal = 10_000),
            "b" to PlayerStats(correctVotes = 3, votesReceivedAsCrew = 4, clueCount = 1, clueMsTotal = 3_000),
            "c" to PlayerStats(correctVotes = 3, correctGuesses = 1, clueCount = 1, clueMsTotal = 3_000),
        )
        assertEquals(
            listOf(
                Award(AwardType.MASTER_OF_DISGUISE, listOf("a"), 2),
                Award(AwardType.DETECTIVE, listOf("b", "c"), 3),
                Award(AwardType.MOST_SUSPICIOUS, listOf("b"), 4),
                Award(AwardType.MIND_READER, listOf("c"), 1),
                Award(AwardType.SPEED_DEMON, listOf("b", "c"), 3_000),
            ),
            Awards.compute(stats),
        )
    }

    @Test
    fun `awards nobody earned are left out`() {
        assertEquals(emptyList(), Awards.compute(mapOf("a" to PlayerStats(), "b" to PlayerStats())))
    }

    @Test
    fun `final result from a played game includes awards`() {
        val h = Harness(4, SettingsPatch(rounds = 1))
        h.startGame()
        h.allReady()
        h.playAllTurns()
        h.send(Event.SkipDiscussion(h.admin))
        h.everyoneVotesFor(h.imposters)
        h.send(Event.Guess(h.imposters.single(), h.round.word))
        h.send(Event.NextRound(h.admin))
        val final = h.room.finalResult!!
        val detective = final.awards.single { it.type == AwardType.DETECTIVE }
        assertEquals(h.crew.toSet(), detective.playerIds.toSet())
        assertEquals(listOf(h.imposters.single()), final.awards.single { it.type == AwardType.MIND_READER }.playerIds)
    }
}

package com.imposter.engine

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LobbyTest {
    @Test
    fun `creator is admin and players join in order`() {
        val h = Harness(4)
        assertEquals("p1", h.room.adminId)
        assertEquals(listOf("p1", "p2", "p3", "p4"), h.room.players.keys.toList())
        assertEquals(Phase.LOBBY, h.room.phase)
        assertTrue(h.room.players.values.all { it.connected })
    }

    @Test
    fun `names must be unique ignoring case and trimmed`() {
        val h = Harness(3)
        h.send(Event.Join("p9", "t", "  player 2 ", 3))
        assertEquals(listOf(ErrorCode.NAME_TAKEN), h.errors())
        assertFalse("p9" in h.room.players)
    }

    @Test
    fun `invalid name or avatar is rejected`() {
        val h = Harness(3)
        h.send(Event.Join("p9", "t", "   ", 3))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors())
        h.send(Event.Join("p9", "t", "Zed", Rules.AVATAR_COUNT))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors())
    }

    @Test
    fun `room holds at most 12 players`() {
        val h = Harness(12)
        h.send(Event.Join("p13", "t", "Late", 0))
        assertEquals(listOf(ErrorCode.ROOM_FULL), h.errors())
    }

    @Test
    fun `admin can update settings, others cannot`() {
        val h = Harness(3)
        h.send(Event.UpdateSettings("p1", SettingsPatch(rounds = 5, category = "food", language = Lang.AR)))
        assertEquals(5, h.room.settings.rounds)
        assertEquals("food", h.room.settings.category)
        assertEquals(Lang.AR, h.room.settings.language)

        h.send(Event.UpdateSettings("p2", SettingsPatch(rounds = 2)))
        assertEquals(listOf(ErrorCode.NOT_ADMIN), h.errors())
        assertEquals(5, h.room.settings.rounds)
    }

    @Test
    fun `out of range settings are rejected atomically`() {
        val h = Harness(3)
        for (patch in listOf(
            SettingsPatch(rounds = 11),
            SettingsPatch(rounds = 0),
            SettingsPatch(turnSeconds = 9),
            SettingsPatch(turnSeconds = 61),
            SettingsPatch(discussionSeconds = 29),
            SettingsPatch(discussionSeconds = 301),
            SettingsPatch(clueRounds = 0),
            SettingsPatch(clueRounds = 6),
            SettingsPatch(imposterCount = 0),
            SettingsPatch(imposterCount = 6),
            SettingsPatch(category = "nope"),
            SettingsPatch(rounds = 4, category = "animals", language = Lang.AR), // no Arabic animal words
        )) {
            h.send(Event.UpdateSettings("p1", patch))
            assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors(), "patch $patch")
        }
        assertEquals(Settings(), h.room.settings)
    }

    @Test
    fun `admin can kick a player from the lobby`() {
        val h = Harness(4)
        val effects = h.send(Event.Kick("p1", "p3"))
        assertTrue(Effect.Kicked("p3") in effects)
        assertFalse("p3" in h.room.players)
        assertTrue(Effect.BroadcastState in effects)
    }

    @Test
    fun `non-admin cannot kick and admin cannot kick themselves`() {
        val h = Harness(4)
        h.send(Event.Kick("p2", "p3"))
        assertEquals(listOf(ErrorCode.NOT_ADMIN), h.errors())
        h.send(Event.Kick("p1", "p1"))
        assertEquals(listOf(ErrorCode.INVALID_INPUT), h.errors())
    }

    @Test
    fun `cannot kick mid-game`() {
        val h = Harness(4)
        h.startGame()
        h.send(Event.Kick("p1", "p3"))
        assertEquals(listOf(ErrorCode.WRONG_PHASE), h.errors())
    }

    @Test
    fun `start needs at least 3 players`() {
        val h = Harness(2)
        h.startGame()
        assertEquals(listOf(ErrorCode.NOT_ENOUGH_PLAYERS), h.errors())
        assertEquals(Phase.LOBBY, h.room.phase)
    }

    @Test
    fun `start rejects more imposters than the player count allows`() {
        val h = Harness(4, SettingsPatch(imposterCount = 2))
        h.startGame()
        assertEquals(listOf(ErrorCode.TOO_MANY_IMPOSTERS), h.errors())

        val five = Harness(5, SettingsPatch(imposterCount = 2))
        five.startGame()
        assertEquals(Phase.REVEAL, five.room.phase)
        assertEquals(2, five.imposters.size)
    }

    @Test
    fun `only the admin can start`() {
        val h = Harness(3)
        h.send(Event.StartGame("p2"))
        assertEquals(listOf(ErrorCode.NOT_ADMIN), h.errors())
    }

    @Test
    fun `unknown players are rejected`() {
        val h = Harness(3)
        h.send(Event.Ready("ghost"))
        assertEquals(listOf(ErrorCode.WRONG_PHASE), h.errors())
        h.send(Event.StartGame("ghost"))
        assertEquals(listOf(ErrorCode.UNKNOWN_PLAYER), h.errors())
    }

    @Test
    fun `players joining mid-game wait and enter at the next game`() {
        val h = Harness(3, SettingsPatch(rounds = 1))
        h.startGame()
        h.send(Event.Join("p4", "token-p4", "Late", 2))
        h.send(Event.Connected("p4"))
        assertTrue(h.room.players.getValue("p4").waiting)
        assertFalse("p4" in h.round.participantIds)
        assertTrue(h.lastEffects.none { it is Effect.SendRole })

        h.send(Event.Ready("p4"))
        assertEquals(listOf(ErrorCode.NOT_IN_GAME), h.errors())

        h.playRound { setOf(h.crew.first()) }
        h.send(Event.NextRound(h.admin))
        assertEquals(Phase.FINAL, h.room.phase)
        h.send(Event.PlayAgain(h.admin))
        assertFalse(h.room.players.getValue("p4").waiting)

        h.startGame()
        assertTrue("p4" in h.round.participantIds)
    }

    @Test
    fun `failed actions do not broadcast state`() {
        val h = Harness(3)
        val effects = h.send(Event.StartGame("p2"))
        assertTrue(Effect.BroadcastState !in effects)
        assertNull(h.room.round)
    }
}

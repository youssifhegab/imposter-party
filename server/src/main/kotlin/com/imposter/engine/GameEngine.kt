package com.imposter.engine

import com.imposter.engine.Effect.ScheduleTimer
import com.imposter.engine.Phase.CLUES
import com.imposter.engine.Phase.DISCUSSION
import com.imposter.engine.Phase.FINAL
import com.imposter.engine.Phase.GUESS
import com.imposter.engine.Phase.LOBBY
import com.imposter.engine.Phase.RESULTS
import com.imposter.engine.Phase.REVEAL
import com.imposter.engine.Phase.REVOTE
import com.imposter.engine.Phase.VOTING
import kotlin.random.Random

/**
 * The game rules as a pure state machine: (room, event) -> (new room, effects).
 *
 * No sockets, threads, or real time. The clock and randomness are injected so tests are deterministic.
 * Callers must feed events for one room one at a time (the room actor in Milestone 3 guarantees that).
 */
class GameEngine(
    private val words: WordBank,
    private val clock: () -> Long,
    private val random: Random,
) {
    fun createRoom(
        code: String,
        playerId: String,
        token: String,
        name: String,
        avatar: Int,
        language: Lang,
    ): Pair<Room, List<Effect>> {
        val cleanName = requireNotNull(cleanName(name)) { "invalid name" }
        require(avatar in 0 until Rules.AVATAR_COUNT) { "invalid avatar" }
        val now = clock()
        val admin = Player(playerId, token, cleanName, avatar, joinedAt = now, disconnectedAt = now)
        val room = Room(
            code = code,
            adminId = playerId,
            settings = Settings(language = language),
            players = mapOf(playerId to admin),
        )
        // The creator's seat is held until their socket connects, like everyone else's.
        return room to listOf(ScheduleTimer(TimerKey.Grace(playerId), now + Rules.GRACE_MS))
    }

    fun handle(room: Room, event: Event): Pair<Room, List<Effect>> {
        val step = Step(room, clock())
        // `with(x) { ... }` makes x the receiver inside the block, so the Step.* extension functions below
        // can be called as if they were members.
        with(step) {
            when (event) {
                is Event.Join -> join(event)
                is Event.Connected -> connected(event.playerId, event.recentWordIds)
                is Event.Disconnected -> disconnected(event.playerId)
                is Event.UpdateSettings -> updateSettings(event)
                is Event.Kick -> kick(event)
                is Event.StartGame -> startGame(event.playerId)
                is Event.Ready -> ready(event.playerId)
                is Event.SubmitClue -> submitClue(event)
                is Event.EndTurn -> endTurn(event.playerId)
                is Event.SkipDiscussion -> skipDiscussion(event.playerId)
                is Event.Vote -> vote(event)
                is Event.Guess -> guess(event)
                is Event.NextRound -> nextRound(event.playerId)
                is Event.PlayAgain -> playAgain(event.playerId)
                is Event.Leave -> if (event.playerId in room.players) releaseSeat(event.playerId)
                is Event.TimerFired -> timerFired(event.key)
            }
        }
        if (step.room != room) step.emit(Effect.BroadcastState)
        return step.room to step.effects.toList()
    }

    /**
     * Scratchpad for one handle() call. It is mutable, but it never escapes handle(), so the engine as a
     * whole stays pure. This reads much better than threading (room, effects) through every function.
     */
    private class Step(var room: Room, val now: Long) {
        val effects = mutableListOf<Effect>()
        val round: Round get() = checkNotNull(room.round) { "no active round" }

        fun emit(effect: Effect) {
            effects += effect
        }

        fun fail(playerId: String, code: ErrorCode) = emit(Effect.SendError(playerId, code))

        fun updateRound(change: (Round) -> Round) {
            room = room.copy(round = change(round))
        }

        fun updatePlayer(id: String, change: (Player) -> Player) {
            val player = room.players[id] ?: return
            room = room.copy(players = room.players + (id to change(player)))
        }

        fun isConnected(id: String) = room.players[id]?.connected == true
    }

    // region Guards: each reports an error to the sender and returns false when the action is not allowed.

    private fun Step.isPlayer(id: String): Boolean =
        (id in room.players).also { if (!it) fail(id, ErrorCode.UNKNOWN_PLAYER) }

    private fun Step.isAdmin(id: String): Boolean = when {
        !isPlayer(id) -> false
        room.adminId != id -> false.also { fail(id, ErrorCode.NOT_ADMIN) }
        else -> true
    }

    private fun Step.inPhase(id: String, vararg phases: Phase): Boolean =
        (room.phase in phases).also { if (!it) fail(id, ErrorCode.WRONG_PHASE) }

    private fun Step.isParticipant(id: String): Boolean = when {
        !isPlayer(id) -> false
        id !in round.participantIds -> false.also { fail(id, ErrorCode.NOT_IN_GAME) }
        else -> true
    }

    // endregion

    // region Membership

    private fun Step.join(e: Event.Join) {
        val name = cleanName(e.name)
        when {
            name == null || e.avatar !in 0 until Rules.AVATAR_COUNT -> fail(e.playerId, ErrorCode.INVALID_INPUT)
            room.players.size >= Rules.MAX_PLAYERS -> fail(e.playerId, ErrorCode.ROOM_FULL)
            room.players.values.any { it.name.equals(name, ignoreCase = true) } ->
                fail(e.playerId, ErrorCode.NAME_TAKEN)

            else -> {
                val player = Player(
                    e.playerId, e.token, name, e.avatar,
                    joinedAt = now,
                    disconnectedAt = now,
                    waiting = room.phase != LOBBY,
                )
                room = room.copy(players = room.players + (player.id to player), emptySince = null)
                emit(ScheduleTimer(TimerKey.Grace(player.id), now + Rules.GRACE_MS))
            }
        }
    }

    private fun Step.connected(id: String, recentWordIds: List<Int>?) {
        val player = room.players[id] ?: return fail(id, ErrorCode.UNKNOWN_PLAYER)
        if (!player.connected) {
            updatePlayer(id) { it.copy(connected = true, connectedSince = now, disconnectedAt = null) }
        }
        // Untrusted input from the phone: keep only the newest few hundred ids. Unknown ids simply never match.
        if (recentWordIds != null) {
            updatePlayer(id) { it.copy(recentWordIds = recentWordIds.takeLast(Rules.MAX_RECENT_WORDS).toSet()) }
        }
        emit(Effect.SendState(id))
        val round = room.round
        if (round != null && id in round.participantIds && room.phase != LOBBY && room.phase != FINAL) {
            emit(Effect.SendRole(id, roleFor(round, id)))
        }
        when (room.phase) {
            GUESS -> if (id in round!!.caughtImposterIds && id !in round.guesses) emit(Effect.PromptGuess(id))
            RESULTS -> room.lastResult?.let { emit(Effect.SendRoundResult(Recipient.One(id), it)) }
            FINAL -> room.finalResult?.let { emit(Effect.SendFinalResult(Recipient.One(id), it)) }
            else -> {}
        }
    }

    private fun Step.disconnected(id: String) {
        val player = room.players[id] ?: return
        if (!player.connected) return
        updatePlayer(id) { it.copy(connected = false, connectedSince = null, disconnectedAt = now) }
        emit(ScheduleTimer(TimerKey.Grace(id), now + Rules.GRACE_MS))
        // A drop during your own clue turn doesn't end it: phones lose their connection for a moment all
        // the time (switching apps, a locked screen). The turn timer keeps running, so if they're back in
        // time they still play, and if not, the timeout skips them as usual.
        checkPhaseComplete()
    }

    private fun Step.graceExpired(id: String) {
        val player = room.players[id] ?: return
        val since = player.disconnectedAt ?: return
        if (player.connected || now - since < Rules.GRACE_MS) return
        releaseSeat(id)
    }

    private fun Step.releaseSeat(id: String) {
        val wasAdmin = room.adminId == id
        room = room.copy(players = room.players - id, scores = room.scores - id, stats = room.stats - id)

        if (room.players.isEmpty()) {
            enterLobby()
            room = room.copy(emptySince = now)
            emit(ScheduleTimer(TimerKey.RoomCleanup, now + Rules.EMPTY_ROOM_MS))
            return
        }
        if (wasAdmin) room = room.copy(adminId = nextAdmin())

        val inGame = room.phase != LOBBY && room.phase != FINAL
        if (inGame && round.participantIds.count { it in room.players } < Rules.MIN_PLAYERS) {
            enterLobby()
        } else if (room.phase == CLUES && round.currentPlayerId == id) {
            finishTurn(text = null, skipped = true)
        } else if (inGame) {
            checkPhaseComplete()
        }
    }

    /** The longest-connected player; falls back to the earliest joiner if nobody is connected. */
    private fun Step.nextAdmin(): String = room.players.values
        .sortedWith(compareBy<Player>({ !it.connected }, { it.connectedSince ?: Long.MAX_VALUE }, { it.joinedAt }))
        .first().id

    private fun Step.roomCleanup() {
        val since = room.emptySince ?: return
        if (room.players.isEmpty() && now - since >= Rules.EMPTY_ROOM_MS) emit(Effect.DeleteRoom)
    }

    // endregion

    // region Lobby

    private fun Step.updateSettings(e: Event.UpdateSettings) {
        if (!isAdmin(e.playerId) || !inPhase(e.playerId, LOBBY)) return
        val current = room.settings
        val patch = e.patch
        val next = current.copy(
            category = patch.category ?: current.category,
            language = patch.language ?: current.language,
            imposterCount = patch.imposterCount ?: current.imposterCount,
            impostersKnowEachOther = patch.impostersKnowEachOther ?: current.impostersKnowEachOther,
            rounds = patch.rounds ?: current.rounds,
            turnSeconds = patch.turnSeconds ?: current.turnSeconds,
            discussionSeconds = patch.discussionSeconds ?: current.discussionSeconds,
            clueRounds = patch.clueRounds ?: current.clueRounds,
        )
        // The imposter count is only bounded by the room maximum here; start_game checks it against the
        // actual player count, so the admin can set it before everyone has joined.
        val valid = (next.category == Settings.RANDOM_CATEGORY || words.hasWords(next.category, next.language)) &&
            next.imposterCount in 1..Rules.maxImposters(Rules.MAX_PLAYERS) &&
            next.rounds in Rules.ROUNDS &&
            next.turnSeconds in Rules.TURN_SECONDS &&
            next.discussionSeconds in Rules.DISCUSSION_SECONDS &&
            next.clueRounds in Rules.CLUE_ROUNDS
        if (valid) room = room.copy(settings = next) else fail(e.playerId, ErrorCode.INVALID_INPUT)
    }

    private fun Step.kick(e: Event.Kick) {
        if (!isAdmin(e.playerId) || !inPhase(e.playerId, LOBBY)) return
        if (e.targetId == e.playerId || e.targetId !in room.players) return fail(e.playerId, ErrorCode.INVALID_INPUT)
        emit(Effect.Kicked(e.targetId))
        releaseSeat(e.targetId)
    }

    private fun Step.startGame(id: String) {
        if (!isAdmin(id) || !inPhase(id, LOBBY)) return
        val count = room.players.size
        when {
            count < Rules.MIN_PLAYERS -> fail(id, ErrorCode.NOT_ENOUGH_PLAYERS)
            room.settings.imposterCount > Rules.maxImposters(count) -> fail(id, ErrorCode.TOO_MANY_IMPOSTERS)
            else -> {
                room = room.copy(scores = room.players.keys.associateWith { 0 }, stats = emptyMap())
                startRound(number = 1)
            }
        }
    }

    private fun Step.enterLobby() {
        room = room.copy(
            phase = LOBBY,
            round = null,
            lastResult = null,
            finalResult = null,
            scores = emptyMap(),
            stats = emptyMap(),
            players = room.players.mapValues { (_, player) -> player.copy(waiting = false) },
        )
        clearTimer()
    }

    // endregion

    // region Round flow

    private fun Step.startRound(number: Int) {
        val previous = room.round
        val participants = room.players.values.filter { !it.waiting }.map { it.id }
        val settings = room.settings
        // Avoid, in order of preference: anything used in this party or recently played on someone's phone,
        // then just this party's words, then nothing (a category can run out).
        val recent = participants.flatMap { room.players.getValue(it).recentWordIds }.toSet()
        val avoid = listOf(room.usedWordIds + recent, room.usedWordIds)
        val word = words.pick(settings.category, settings.language, avoid, previous?.category, random)
            ?: return fail(room.adminId, ErrorCode.NO_WORDS)

        val imposterCount = settings.imposterCount.coerceAtMost(Rules.maxImposters(participants.size))
        val imposters = participants.shuffled(random).take(imposterCount).toSet()
        var order = participants.shuffled(random)
        if (order.size > 1 && order.first() == previous?.turnOrder?.firstOrNull()) {
            order = order.drop(1) + order.first()
        }

        val round = Round(
            number = number,
            category = word.category,
            wordId = word.id,
            word = word.text,
            imposterIds = imposters,
            participantIds = participants,
            turnOrder = order,
            clueRounds = settings.clueRounds,
        )
        room = room.copy(phase = REVEAL, round = round, usedWordIds = room.usedWordIds + word.id, lastResult = null)
        participants.forEach { emit(Effect.SendRole(it, roleFor(round, it))) }
        setTimer(Rules.REVEAL_MS)
    }

    private fun Step.roleFor(round: Round, id: String): RoleInfo {
        val isImposter = id in round.imposterIds
        return RoleInfo(
            isImposter = isImposter,
            category = round.category,
            categoryName = words.categoryName(round.category, room.settings.language),
            word = if (isImposter) null else round.word,
            fellowImposterIds = if (isImposter && room.settings.impostersKnowEachOther) {
                (round.imposterIds - id).toList()
            } else {
                null
            },
        )
    }

    private fun Step.ready(id: String) {
        if (!inPhase(id, REVEAL) || !isParticipant(id)) return
        updateRound { it.copy(readyIds = it.readyIds + id) }
        checkPhaseComplete()
    }

    private fun Step.startClues() {
        room = room.copy(phase = CLUES)
        updateRound { it.copy(currentTurnIndex = -1) }
        advanceTurn()
    }

    /**
     * Moves to the next connected player, going around the turn order once per clue round and recording a
     * skip for anyone away. After the last turn of the last clue round, the discussion starts.
     */
    private fun Step.advanceTurn() {
        val order = round.turnOrder
        val total = round.totalTurns
        var index = round.currentTurnIndex + 1
        val skipped = mutableListOf<Clue>()
        while (index < total && !isConnected(order[index % order.size])) {
            skipped += Clue(order[index % order.size], text = null, skipped = true)
            index++
        }
        updateRound { it.copy(currentTurnIndex = index, turnStartedAt = now, clues = it.clues + skipped) }
        if (index >= total) startDiscussion() else setTimer(room.settings.turnSeconds * 1000L)
    }

    private fun Step.finishTurn(text: String?, skipped: Boolean) {
        val playerId = round.currentPlayerId ?: return
        val duration = if (skipped) null else now - round.turnStartedAt
        updateRound { it.copy(clues = it.clues + Clue(playerId, text, skipped, duration)) }
        advanceTurn()
    }

    private fun Step.submitClue(e: Event.SubmitClue) {
        if (!inPhase(e.playerId, CLUES)) return
        if (round.currentPlayerId != e.playerId) return fail(e.playerId, ErrorCode.NOT_YOUR_TURN)
        val text = cleanText(e.text)
        if (text.isEmpty() || text.length > Rules.MAX_CLUE_LENGTH) return fail(e.playerId, ErrorCode.INVALID_INPUT)
        finishTurn(text, skipped = false)
    }

    private fun Step.endTurn(id: String) {
        if (!inPhase(id, CLUES)) return
        if (round.currentPlayerId != id) return fail(id, ErrorCode.NOT_YOUR_TURN)
        finishTurn(text = null, skipped = false)
    }

    private fun Step.startDiscussion() {
        room = room.copy(phase = DISCUSSION)
        setTimer(room.settings.discussionSeconds * 1000L)
    }

    private fun Step.skipDiscussion(id: String) {
        if (!isAdmin(id) || !inPhase(id, DISCUSSION)) return
        startVoting()
    }

    private fun Step.startVoting() {
        room = room.copy(phase = VOTING)
        setTimer(Rules.VOTE_MS)
    }

    private fun Step.vote(e: Event.Vote) {
        val id = e.playerId
        if (!inPhase(id, VOTING, REVOTE) || !isParticipant(id)) return
        val isRevote = room.phase == REVOTE
        if (isRevote && id !in round.revoteVoterIds) return fail(id, ErrorCode.NOT_ALLOWED)
        val ballots = if (isRevote) round.revotes else round.votes
        if (id in ballots) return fail(id, ErrorCode.ALREADY_DONE)

        val pool = if (isRevote) round.revoteCandidates else round.participantIds.toSet()
        val allowed = pool.filter { it in room.players && it != id }.toSet()
        val required = minOf(if (isRevote) round.revoteSlots else round.imposterIds.size, allowed.size)
        val targets = e.targetIds
        if (targets.size != required || targets.toSet().size != targets.size || !allowed.containsAll(targets)) {
            return fail(id, ErrorCode.INVALID_INPUT)
        }

        updateRound {
            if (isRevote) it.copy(revotes = it.revotes + (id to targets)) else it.copy(votes = it.votes + (id to targets))
        }
        checkPhaseComplete()
    }

    private fun Step.finishVoting() {
        val caught = if (room.phase == VOTING) {
            when (val tally = Voting.tally(round.votes, round.imposterIds.size)) {
                is Tally.Decided -> tally.ids
                is Tally.Tie -> {
                    room = room.copy(phase = REVOTE)
                    val seated = round.participantIds.filter { it in room.players }
                    val outside = seated.filter { it !in tally.tied }
                    updateRound {
                        it.copy(
                            lockedIds = tally.locked,
                            revoteCandidates = tally.tied,
                            revoteSlots = tally.slots,
                            revoteVoterIds = (outside.ifEmpty { seated }).toSet(),
                        )
                    }
                    setTimer(Rules.REVOTE_MS)
                    return
                }
            }
        } else {
            // A tie that survives the revote catches nobody from the tie.
            round.lockedIds + when (val tally = Voting.tally(round.revotes, round.revoteSlots)) {
                is Tally.Decided -> tally.ids
                is Tally.Tie -> tally.locked
            }
        }

        updateRound { it.copy(caughtIds = caught) }
        if (round.caughtImposterIds.isEmpty()) return finishRound()
        room = room.copy(phase = GUESS)
        setTimer(Rules.GUESS_MS)
        round.caughtImposterIds.forEach { emit(Effect.PromptGuess(it)) }
        checkPhaseComplete()
    }

    private fun Step.guess(e: Event.Guess) {
        val id = e.playerId
        if (!inPhase(id, GUESS) || !isPlayer(id)) return
        if (id !in round.caughtImposterIds) return fail(id, ErrorCode.NOT_ALLOWED)
        if (id in round.guesses) return fail(id, ErrorCode.ALREADY_DONE)
        val text = cleanText(e.text)
        if (text.isEmpty() || text.length > Rules.MAX_GUESS_LENGTH) return fail(id, ErrorCode.INVALID_INPUT)
        updateRound { it.copy(guesses = it.guesses + (id to GuessAttempt(text, GuessMatcher.matches(text, it.word)))) }
        checkPhaseComplete()
    }

    private fun Step.finishRound() {
        val round = this.round
        val seated = round.participantIds.filter { it in room.players }
        val points = Scoring.roundPoints(round, seated)
        val scores = room.scores + seated.associateWith { (room.scores[it] ?: 0) + points.getValue(it) }
        val stats = Awards.updateStats(room.stats, round, seated)
        val result = RoundResult(
            roundNumber = round.number,
            wordId = round.wordId,
            votes = round.votes,
            revotes = round.revotes.takeIf { round.revoteCandidates.isNotEmpty() },
            caughtIds = round.caughtIds,
            imposterIds = round.imposterIds,
            word = round.word,
            categoryName = words.categoryName(round.category, room.settings.language),
            guesses = round.guesses,
            points = points,
            scores = scores,
            catchStreaks = stats.filterKeys { it in seated }.mapValues { it.value.catchStreak },
        )
        room = room.copy(phase = RESULTS, scores = scores, stats = stats, lastResult = result)
        clearTimer()
        emit(Effect.SendRoundResult(Recipient.All, result))
    }

    private fun Step.nextRound(id: String) {
        if (!isAdmin(id) || !inPhase(id, RESULTS)) return
        if (round.number >= room.settings.rounds) finishGame() else startRound(round.number + 1)
    }

    private fun Step.finishGame() {
        val result = FinalResult(Scoring.leaderboard(room.scores), Awards.compute(room.stats))
        room = room.copy(phase = FINAL, finalResult = result)
        clearTimer()
        emit(Effect.SendFinalResult(Recipient.All, result))
    }

    private fun Step.playAgain(id: String) {
        if (!isAdmin(id) || !inPhase(id, FINAL)) return
        enterLobby()
    }

    /**
     * Ends REVEAL, VOTING, REVOTE, or GUESS early once every seated player who still owes an action has
     * acted. A player whose connection dropped still counts: phones drop for a moment all the time (a locked
     * screen, switching apps), so the phase waits for them until its timer runs out. Only players who have
     * left (seat released) stop counting.
     */
    private fun Step.checkPhaseComplete() {
        val round = room.round ?: return
        val present = round.participantIds.filter { it in room.players }
        when (room.phase) {
            REVEAL -> if (present.all { it in round.readyIds }) startClues()
            VOTING -> if (present.all { it in round.votes }) finishVoting()
            REVOTE -> if (present.filter { it in round.revoteVoterIds }.all { it in round.revotes }) finishVoting()
            GUESS -> if (round.caughtImposterIds.all { it in round.guesses || it !in room.players }) finishRound()
            else -> {}
        }
    }

    // endregion

    // region Timers

    private fun Step.setTimer(durationMs: Long) {
        val seq = room.timerSeq + 1
        val at = now + durationMs
        room = room.copy(timerSeq = seq, endsAt = at)
        emit(ScheduleTimer(TimerKey.PhaseTimer(seq), at))
    }

    private fun Step.clearTimer() {
        room = room.copy(timerSeq = room.timerSeq + 1, endsAt = null)
    }

    private fun Step.timerFired(key: TimerKey) {
        when (key) {
            is TimerKey.Grace -> graceExpired(key.playerId)
            TimerKey.RoomCleanup -> roomCleanup()
            is TimerKey.PhaseTimer -> {
                if (key.seq != room.timerSeq) return
                when (room.phase) {
                    REVEAL -> startClues()
                    CLUES -> finishTurn(text = null, skipped = true)
                    DISCUSSION -> startVoting()
                    VOTING, REVOTE -> finishVoting()
                    GUESS -> finishRound()
                    LOBBY, RESULTS, FINAL -> {}
                }
            }
        }
    }

    // endregion

    companion object {
        private val WHITESPACE = Regex("\\s+")

        fun cleanText(raw: String): String = raw.trim().replace(WHITESPACE, " ")

        /** A trimmed display name, or null if it is empty or too long. */
        fun cleanName(raw: String): String? = cleanText(raw).takeIf { it.length in 1..Rules.MAX_NAME_LENGTH }
    }
}

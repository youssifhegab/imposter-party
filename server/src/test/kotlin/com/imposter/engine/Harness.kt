package com.imposter.engine

import kotlin.random.Random

object Fixtures {
    private val categories = listOf(
        Category("food", "🍕", mapOf(Lang.EN to "Food", Lang.AR to "طعام")),
        Category("animals", "🦁", mapOf(Lang.EN to "Animals", Lang.AR to "حيوانات")),
        Category("places", "🏖️", mapOf(Lang.EN to "Places", Lang.AR to "أماكن")),
    )

    private val wordTexts = mapOf(
        ("food" to Lang.EN) to listOf("Pizza", "Burger", "Sushi", "Falafel"),
        ("animals" to Lang.EN) to listOf("Lion", "Elephant", "Giraffe", "Penguin"),
        ("places" to Lang.EN) to listOf("Beach", "Airport", "Hospital", "Library"),
        ("food" to Lang.AR) to listOf("بيتزا", "فلافل", "كشري", "شاورما"),
    )

    val bank = WordBank(
        categories,
        wordTexts.entries.flatMap { (key, texts) -> texts.map { key to it } }
            .mapIndexed { index, (key, text) -> Word(index + 1, key.first, key.second, text) },
    )
}

/**
 * Drives a GameEngine like the real server would: keeps the latest room, a fake clock, and the scheduled
 * timers, and fires due timers when time is advanced.
 */
class Harness(playerCount: Int = 4, settings: SettingsPatch? = null, seed: Int = 7, bank: WordBank = Fixtures.bank) {
    var now = 1_000_000L
    val engine = GameEngine(bank, { now }, Random(seed))
    val ids = (1..playerCount).map { "p$it" }
    lateinit var room: Room
    var lastEffects: List<Effect> = emptyList()
    val allEffects = mutableListOf<Effect>()
    private val timers = mutableListOf<Effect.ScheduleTimer>()

    init {
        val (created, effects) = engine.createRoom("ABCDE", "p1", "token-p1", "Player 1", 0, Lang.EN)
        room = created
        record(effects)
        ids.drop(1).forEach { send(Event.Join(it, "token-$it", "Player ${it.drop(1)}", 1)) }
        ids.forEach { send(Event.Connected(it)) }
        settings?.let { send(Event.UpdateSettings("p1", it)) }
    }

    val admin: String get() = room.adminId
    val round: Round get() = room.round!!
    val imposters: Set<String> get() = round.imposterIds
    val crew: List<String> get() = round.participantIds - imposters

    fun send(event: Event): List<Effect> {
        val (next, effects) = engine.handle(room, event)
        room = next
        record(effects)
        return effects
    }

    private fun record(effects: List<Effect>) {
        lastEffects = effects
        allEffects += effects
        timers += effects.filterIsInstance<Effect.ScheduleTimer>()
    }

    /** Moves the clock forward, firing every timer that comes due on the way (stale ones included). */
    fun elapse(ms: Long) {
        val target = now + ms
        while (true) {
            val next = timers.filter { it.at <= target }.minByOrNull { it.at } ?: break
            timers.remove(next)
            now = maxOf(now, next.at)
            send(Event.TimerFired(next.key))
        }
        now = target
    }

    /** Runs out the current phase or turn timer. */
    fun expire() = elapse(room.endsAt!! - now)

    fun errors(effects: List<Effect> = lastEffects) = effects.filterIsInstance<Effect.SendError>().map { it.code }

    fun startGame() = send(Event.StartGame(admin))

    fun allReady() {
        round.participantIds.forEach { if (room.phase == Phase.REVEAL) send(Event.Ready(it)) }
    }

    fun playAllTurns() {
        while (room.phase == Phase.CLUES) send(Event.EndTurn(round.currentPlayerId!!))
    }

    fun toVoting() {
        startGame()
        allReady()
        playAllTurns()
        send(Event.SkipDiscussion(admin))
    }

    /** A valid ballot for [voter] that prefers [preferred] and fills any remaining slots with other players. */
    fun ballot(voter: String, preferred: Collection<String>): List<String> {
        val pool = if (room.phase == Phase.REVOTE) round.revoteCandidates.toList() else round.participantIds
        val slots = if (room.phase == Phase.REVOTE) round.revoteSlots else imposters.size
        return (preferred.filter { it in pool } + pool).distinct().filter { it != voter }.take(slots)
    }

    /** Everyone still voting votes for [preferred] (falling back to others when they can't). */
    fun everyoneVotesFor(preferred: Collection<String>) {
        val phase = room.phase
        val voters = if (phase == Phase.REVOTE) round.participantIds.filter { it in round.revoteVoterIds } else round.participantIds
        voters.forEach { if (room.phase == phase) send(Event.Vote(it, ballot(it, preferred))) }
    }

    /** Plays one full round from REVEAL to RESULTS where [catch] decides who everyone votes for. */
    fun playRound(catch: (Round) -> Collection<String>) {
        allReady()
        playAllTurns()
        send(Event.SkipDiscussion(admin))
        everyoneVotesFor(catch(round))
        while (room.phase == Phase.GUESS) {
            round.caughtImposterIds.filter { it !in round.guesses }.forEach { send(Event.Guess(it, "nope")) }
        }
    }
}

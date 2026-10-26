package com.imposter.content

import com.imposter.engine.Category
import com.imposter.engine.Effect
import com.imposter.engine.Event
import com.imposter.engine.GuessMatcher
import com.imposter.engine.Harness
import com.imposter.engine.Lang
import com.imposter.engine.Phase
import com.imposter.engine.Rules
import com.imposter.engine.SettingsPatch
import com.imposter.engine.Word
import com.imposter.engine.WordBank
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Checks the real word list in `content/words.json`, and that every category plays in both languages. */
class ContentTest {
    private val content = SeedContent.parse()
    private val langs = Lang.entries.map { it.code }

    // Same shape as ContentRepository builds from Postgres, without the database.
    private val bank = WordBank(
        content.categories.map { c -> Category(c.slug, c.icon, c.names.mapKeys { Lang.fromCode(it.key)!! }) },
        content.categories.flatMap { c -> c.words.flatMap { (lang, words) -> words.map { Triple(c.slug, lang, it) } } }
            .mapIndexed { i, (slug, lang, text) -> Word(i + 1, slug, Lang.fromCode(lang)!!, text) },
    )

    @Test
    fun `there are 12 categories, each named and filled in both languages`() {
        assertEquals(12, content.categories.size)
        assertEquals(content.categories.size, content.categories.map { it.slug }.toSet().size)
        for (category in content.categories) {
            assertEquals(langs.toSet(), category.names.keys, "${category.slug} names")
            assertEquals(langs.toSet(), category.words.keys, "${category.slug} word languages")
            category.words.forEach { (lang, words) ->
                assertTrue(words.size >= MIN_WORDS, "${category.slug}/$lang has only ${words.size} words")
            }
        }
    }

    @Test
    fun `words are clean, short enough to guess, and in the right script`() {
        forEachWord { slug, lang, word ->
            val where = "$slug/$lang \"$word\""
            assertEquals(word.trim(), word, "$where has outer spaces")
            assertTrue(word.length <= Rules.MAX_GUESS_LENGTH, "$where is longer than a guess may be")
            assertTrue(GuessMatcher.normalize(word).isNotEmpty(), "$where normalizes to nothing")
            assertTrue(GuessMatcher.matches(word, word), "$where does not match itself")
            when (lang) {
                "ar" -> assertTrue(word.none { it in 'a'..'z' || it in 'A'..'Z' }, "$where has Latin letters")
                "en" -> assertTrue(word.none { it in '؀'..'ۿ' }, "$where has Arabic letters")
            }
        }
    }

    @Test
    fun `no word could be accepted as a guess for another word in its category`() {
        val clashes = content.categories.flatMap { category ->
            category.words.flatMap { (lang, words) ->
                words.withIndex().flatMap { (i, a) ->
                    words.drop(i + 1).filter { b -> GuessMatcher.matches(a, b) }.map { b -> "${category.slug}/$lang: $a ~ $b" }
                }
            }
        }
        assertTrue(clashes.isEmpty(), "A guess for one would be accepted for the other:\n${clashes.joinToString("\n")}")
    }

    @Test
    fun `no word appears in two categories`() {
        for (lang in langs) {
            val owners = content.categories
                .flatMap { c -> c.words.getValue(lang).map { GuessMatcher.normalize(it) to c.slug } }
                .groupBy({ it.first }, { it.second })
                .filterValues { it.size > 1 }
            assertTrue(owners.isEmpty(), "$lang duplicates: $owners")
        }
    }

    @Test
    fun `every category plays a round in both languages`() {
        for (category in content.categories) {
            for (lang in Lang.entries) {
                val h = Harness(settings = SettingsPatch(category = category.slug, language = lang), bank = bank)
                h.startGame()
                assertEquals(Phase.REVEAL, h.room.phase, "${category.slug}/$lang did not start: ${h.errors()}")

                val roles = h.lastEffects.filterIsInstance<Effect.SendRole>().map { it.role }
                val word = roles.mapNotNull { it.word }.distinct().single()
                assertTrue(word in category.words.getValue(lang.code))
                roles.forEach { assertEquals(category.names.getValue(lang.code), it.categoryName) }

                // The caught imposter types the word and it is accepted.
                val imposter = h.imposters.single()
                h.allReady()
                h.playAllTurns()
                h.send(Event.SkipDiscussion(h.admin))
                h.everyoneVotesFor(listOf(imposter))
                assertEquals(Phase.GUESS, h.room.phase)
                h.send(Event.Guess(imposter, word))
                assertEquals(Phase.RESULTS, h.room.phase)
                val result = h.lastEffects.filterIsInstance<Effect.SendRoundResult>().single().result
                assertTrue(result.guesses.getValue(imposter).correct, "${category.slug}/$lang guess \"$word\" was rejected")
            }
        }
    }

    private fun forEachWord(check: (slug: String, lang: String, word: String) -> Unit) =
        content.categories.forEach { c -> c.words.forEach { (lang, words) -> words.forEach { check(c.slug, lang, it) } } }

    private companion object {
        const val MIN_WORDS = 150
    }
}

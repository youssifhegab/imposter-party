package com.imposter.engine

import kotlin.random.Random

data class Category(val slug: String, val icon: String, val names: Map<Lang, String>)

data class Word(val id: Int, val category: String, val lang: Lang, val text: String)

/**
 * All categories and words, held in memory. The full set is small (~1,500 words), so the server loads it
 * from Postgres once and the engine picks from it without touching the database.
 */
class WordBank(val categories: List<Category>, words: List<Word>) {
    private val categoriesBySlug = categories.associateBy { it.slug }
    private val wordsByCategoryAndLang = words.groupBy { it.category to it.lang }

    fun wordsIn(slug: String, lang: Lang): List<Word> = wordsByCategoryAndLang[slug to lang].orEmpty()

    fun hasWords(slug: String, lang: Lang): Boolean = wordsIn(slug, lang).isNotEmpty()

    fun categoryName(slug: String, lang: Lang): String = categoriesBySlug[slug]?.names?.get(lang) ?: slug

    /**
     * Picks a word, trying each set in [avoid] in turn (strictest first) and taking a word outside the first
     * set that leaves one. If every set covers the whole category, words repeat. With
     * [Settings.RANDOM_CATEGORY] the category also changes from [previousCategory] when another one is available.
     */
    fun pick(choice: String, lang: Lang, avoid: List<Set<Int>>, previousCategory: String?, random: Random): Word? {
        for (used in avoid + listOf(emptySet())) {
            val slug = if (choice == Settings.RANDOM_CATEGORY) {
                randomCategory(lang, used, previousCategory, random) ?: continue
            } else {
                choice
            }
            val fresh = wordsIn(slug, lang).filter { it.id !in used }
            if (fresh.isNotEmpty()) return fresh.random(random)
        }
        return null
    }

    fun pick(choice: String, lang: Lang, used: Set<Int>, previousCategory: String?, random: Random): Word? =
        pick(choice, lang, listOf(used), previousCategory, random)

    /** A category with words outside [used], preferring one other than [previous]; null if none has any. */
    private fun randomCategory(lang: Lang, used: Set<Int>, previous: String?, random: Random): String? {
        val withFreshWords = categoriesBySlug.keys.filter { slug -> wordsIn(slug, lang).any { it.id !in used } }
        return withFreshWords.filter { it != previous }.ifEmpty { withFreshWords }.randomOrNull(random)
    }
}

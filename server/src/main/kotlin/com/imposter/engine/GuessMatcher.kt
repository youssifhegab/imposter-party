package com.imposter.engine

import java.text.Normalizer
import java.util.Locale

// `object` is a singleton: one instance, created lazily, no constructor. Good for stateless helpers.
object GuessMatcher {
    private const val TYPO_MIN_LETTERS = 5
    private const val ARABIC_ARTICLE = "ال"

    // Tashkeel (harakat, shadda, sukun, tanween), superscript alef, Quranic marks, and tatweel.
    private val ARABIC_MARKS = Regex("[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]")
    private val COMBINING_MARKS = Regex("\\p{Mn}+")
    private val NON_LETTERS = Regex("[^\\p{L}\\p{Nd}]+")
    private val ENGLISH_ARTICLE = Regex("^(the|a|an) ")

    fun matches(guess: String, word: String): Boolean {
        val g = normalize(guess)
        val w = normalize(word)
        if (g.isEmpty()) return false
        if (g == w) return true
        return w.count { it != ' ' } >= TYPO_MIN_LETTERS && withinOneEdit(g, w)
    }

    fun normalize(raw: String): String {
        var s = raw.lowercase(Locale.ROOT)
        s = ARABIC_MARKS.replace(s, "")
        s = s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا')
            .replace('ة', 'ه')
            .replace('ى', 'ي')
        // Decompose and drop remaining combining marks, so "café" matches "cafe".
        s = COMBINING_MARKS.replace(Normalizer.normalize(s, Normalizer.Form.NFD), "")
        // Punctuation and runs of whitespace become a single space, so "ice-cream" matches "ice cream".
        s = NON_LETTERS.replace(s, " ").trim()
        s = ENGLISH_ARTICLE.replace(s, "")
        if (s.startsWith(ARABIC_ARTICLE) && s.length - ARABIC_ARTICLE.length >= 2) s = s.removePrefix(ARABIC_ARTICLE)
        return s
    }

    private fun withinOneEdit(a: String, b: String): Boolean {
        if (kotlin.math.abs(a.length - b.length) > 1) return false
        return levenshtein(a, b) <= 1
    }

    private fun levenshtein(a: String, b: String): Int {
        var previous = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            val current = IntArray(b.length + 1)
            current[0] = i
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                current[j] = minOf(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
            }
            previous = current
        }
        return previous[b.length]
    }
}

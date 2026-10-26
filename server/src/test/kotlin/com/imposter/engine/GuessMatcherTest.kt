package com.imposter.engine

import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import kotlin.test.assertEquals

class GuessMatcherTest {
    @ParameterizedTest(name = "\"{0}\" vs \"{1}\" -> {2}")
    @MethodSource("cases")
    fun `guess matching`(guess: String, word: String, expected: Boolean) {
        assertEquals(expected, GuessMatcher.matches(guess, word))
    }

    @Test
    fun `normalize applies every rule`() {
        assertEquals("ايس كريم", GuessMatcher.normalize("  آيِس   كْرِيم "))
        assertEquals("مدرسه", GuessMatcher.normalize("المـدرسة"))
        assertEquals("lion king", GuessMatcher.normalize("The  Lion-King!"))
    }

    companion object {
        // @JvmStatic exposes this as a real Java static method, which JUnit's @MethodSource requires.
        @JvmStatic
        fun cases(): List<Arguments> = listOf(
            // English: case, spacing, articles
            Arguments.of("Pizza", "pizza", true),
            Arguments.of("  pizza  ", "Pizza", true),
            Arguments.of("ice   cream", "Ice Cream", true),
            Arguments.of("ice-cream", "Ice Cream", true),
            Arguments.of("the Eiffel Tower", "Eiffel Tower", true),
            Arguments.of("THE Lion King", "lion king", true),
            Arguments.of("an apple", "Apple", true),
            Arguments.of("a banana", "banana", true),
            Arguments.of("café", "Cafe", true),
            // English: one typo allowed only for 5+ letters
            Arguments.of("elephnt", "Elephant", true),
            Arguments.of("girafe", "Giraffe", true),
            Arguments.of("pizzza", "Pizza", true),
            Arguments.of("piza", "Pizza", true),
            Arguments.of("car", "Cat", false),
            Arguments.of("lino", "Lion", false),
            Arguments.of("pasta", "Pizza", false),
            Arguments.of("tiger", "Lion", false),
            Arguments.of("", "Pizza", false),
            Arguments.of("   ", "Pizza", false),
            // Arabic: tashkeel and tatweel
            Arguments.of("قِطَّة", "قطة", true),
            Arguments.of("قطـــة", "قطة", true),
            // Arabic: alef forms, taa marbuta, alef maqsura
            Arguments.of("أسد", "اسد", true),
            Arguments.of("إبريق", "ابريق", true),
            Arguments.of("آيس كريم", "ايس كريم", true),
            Arguments.of("قطه", "قطة", true),
            Arguments.of("مستشفى", "مستشفي", true),
            Arguments.of("كرسى", "كرسي", true),
            // Arabic: leading "ال" on either side
            Arguments.of("الأسد", "أسد", true),
            Arguments.of("أسد", "الأسد", true),
            Arguments.of("البيتزا", "بيتزا", true),
            Arguments.of("  الأهرامات  ", "الاهرامات", true),
            // Arabic: typos and mismatches
            Arguments.of("برتقان", "برتقال", true),
            Arguments.of("فول", "فيل", false),
            Arguments.of("قط", "كلب", false),
            Arguments.of("شاي", "قهوة", false),
        )
    }
}

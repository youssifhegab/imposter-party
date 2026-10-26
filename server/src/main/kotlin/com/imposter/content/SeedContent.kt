package com.imposter.content

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue

/** One category in `content/words.json`. Maps are keyed by language code ("en", "ar"). */
data class SeedCategory(
    val slug: String,
    val icon: String,
    val names: Map<String, String>,
    val words: Map<String, List<String>>,
)

data class SeedFile(val categories: List<SeedCategory>)

/** The built-in categories and words. `content/words.json` is the source of truth; Postgres mirrors it. */
object SeedContent {
    const val RESOURCE = "content/words.json"

    fun bytes(): ByteArray = requireNotNull(SeedContent::class.java.classLoader.getResourceAsStream(RESOURCE)) {
        "$RESOURCE is missing from the classpath"
    }.use { it.readBytes() }

    fun parse(bytes: ByteArray = bytes()): SeedFile = jacksonObjectMapper().readValue(bytes)
}

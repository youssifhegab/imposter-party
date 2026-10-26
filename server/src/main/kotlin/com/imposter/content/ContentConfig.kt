package com.imposter.content

import com.imposter.engine.Category
import com.imposter.engine.Lang
import com.imposter.engine.Word
import com.imposter.engine.WordBank
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.jdbc.core.simple.JdbcClient

/**
 * Loads every category and word from Postgres once at startup.
 *
 * A @Bean method's return value becomes a bean other classes can ask for (here, the WordBank the engine uses).
 * @Profile("!test") skips this in tests, which provide a small in-memory WordBank instead of a database.
 */
@Configuration
@Profile("!test")
class ContentConfig {
    @Bean
    fun wordBank(jdbc: JdbcClient): WordBank = ContentRepository(jdbc).load()
}

/**
 * Plain SQL through JdbcClient (part of the Spring Data JDBC starter). The content is read-only and loaded
 * with two joins, so mapping rows by hand is simpler here than defining repository entities.
 */
class ContentRepository(private val jdbc: JdbcClient) {
    private val log = LoggerFactory.getLogger(ContentRepository::class.java)

    private data class NameRow(val slug: String, val icon: String, val lang: String, val name: String)

    fun load(): WordBank {
        val names = jdbc.sql(
            """
            SELECT c.slug, c.icon, n.lang, n.name
            FROM category c JOIN category_name n ON n.category_id = c.id
            ORDER BY c.id
            """.trimIndent(),
        ).query { rs, _ -> NameRow(rs.getString("slug"), rs.getString("icon"), rs.getString("lang"), rs.getString("name")) }
            .list()

        val categories = names.groupBy { it.slug }.map { (slug, rows) ->
            Category(slug, rows.first().icon, rows.mapNotNull { row -> Lang.fromCode(row.lang)?.let { it to row.name } }.toMap())
        }

        val words = jdbc.sql(
            """
            SELECT w.id, c.slug, w.lang, w.text
            FROM word w JOIN category c ON c.id = w.category_id
            WHERE w.active
            """.trimIndent(),
        ).query { rs, _ ->
            Lang.fromCode(rs.getString("lang"))?.let { Word(rs.getInt("id"), rs.getString("slug"), it, rs.getString("text")) }
        }.list().filterNotNull()

        if (words.isEmpty()) log.warn("No words in the database yet; games cannot start until content is seeded.")
        log.info("Loaded {} categories and {} words", categories.size, words.size)
        return WordBank(categories, words)
    }
}

package db.migration

import com.imposter.content.SeedContent
import org.flywaydb.core.api.migration.BaseJavaMigration
import org.flywaydb.core.api.migration.Context
import java.util.zip.CRC32

/**
 * Syncs `content/words.json` into Postgres.
 *
 * Flyway migrations can be classes as well as SQL files. The `R__` prefix makes this one *repeatable*:
 * instead of running once, Flyway runs it again whenever [getChecksum] changes. The checksum is the JSON's,
 * so editing the word list and restarting the server is all it takes to update the database.
 *
 * The sync upserts rather than recreating rows, so existing word ids stay the same. Words removed from the
 * JSON are marked inactive and categories removed from it are deleted.
 */
@Suppress("ClassName", "unused") // Flyway finds the class by name, and the name must follow its pattern.
class R__Content : BaseJavaMigration() {
    private val json = SeedContent.bytes()

    override fun getChecksum(): Int = CRC32().apply { update(json) }.value.toInt()

    override fun migrate(context: Context) {
        val db = context.connection
        val content = SeedContent.parse(json)

        val categoryIds = content.categories.associate { category ->
            val id = db.prepareStatement(
                "INSERT INTO category (slug, icon) VALUES (?, ?) " +
                    "ON CONFLICT (slug) DO UPDATE SET icon = EXCLUDED.icon RETURNING id",
            ).use { st ->
                st.setString(1, category.slug)
                st.setString(2, category.icon)
                st.executeQuery().use { rs -> rs.next(); rs.getInt(1) }
            }
            category.slug to id
        }

        db.prepareStatement("DELETE FROM category WHERE NOT (slug = ANY (?))").use { st ->
            st.setArray(1, db.createArrayOf("text", categoryIds.keys.toTypedArray()))
            st.executeUpdate()
        }

        db.prepareStatement(
            "INSERT INTO category_name (category_id, lang, name) VALUES (?, ?, ?) " +
                "ON CONFLICT (category_id, lang) DO UPDATE SET name = EXCLUDED.name",
        ).use { st ->
            for (category in content.categories) {
                for ((lang, name) in category.names) {
                    st.setInt(1, categoryIds.getValue(category.slug))
                    st.setString(2, lang)
                    st.setString(3, name)
                    st.addBatch()
                }
            }
            st.executeBatch()
        }

        db.prepareStatement("UPDATE word SET active = FALSE").use { it.executeUpdate() }
        db.prepareStatement(
            "INSERT INTO word (category_id, lang, text) VALUES (?, ?, ?) " +
                "ON CONFLICT (category_id, lang, text) DO UPDATE SET active = TRUE",
        ).use { st ->
            for (category in content.categories) {
                for ((lang, words) in category.words) {
                    for (word in words) {
                        st.setInt(1, categoryIds.getValue(category.slug))
                        st.setString(2, lang)
                        st.setString(3, word)
                        st.addBatch()
                    }
                }
            }
            st.executeBatch()
        }
    }
}

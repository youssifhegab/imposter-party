-- Lets the content sync (db.migration.R__Content) upsert words by their text, keeping ids stable.
CREATE UNIQUE INDEX word_category_lang_text_idx ON word (category_id, lang, text);

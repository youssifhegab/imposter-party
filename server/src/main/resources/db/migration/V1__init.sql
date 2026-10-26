CREATE TABLE category (
    id   SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL
);

CREATE TABLE category_name (
    category_id INT  NOT NULL REFERENCES category (id) ON DELETE CASCADE,
    lang        TEXT NOT NULL,
    name        TEXT NOT NULL,
    PRIMARY KEY (category_id, lang)
);

CREATE TABLE word (
    id          SERIAL PRIMARY KEY,
    category_id INT     NOT NULL REFERENCES category (id) ON DELETE CASCADE,
    lang        TEXT    NOT NULL,
    text        TEXT    NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX word_category_lang_idx ON word (category_id, lang);

#!/bin/sh
# Dokku's postgres link gives one DATABASE_URL (postgres://user:pass@host:port/db), but Spring wants a JDBC URL
# with the user and password apart. Split it here; hosts that set DB_URL themselves (Fly, local) skip this.
set -e
if [ -n "$DATABASE_URL" ] && [ -z "$DB_URL" ]; then
  rest="${DATABASE_URL#*://}"
  userinfo="${rest%%@*}"
  export DB_USER="${userinfo%%:*}"
  export DB_PASSWORD="${userinfo#*:}"
  export DB_URL="jdbc:postgresql://${rest#*@}"
fi
exec java -jar app.jar

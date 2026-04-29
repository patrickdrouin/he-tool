#!/bin/sh
set -e

# Skip migrations for SQLite (in-memory demo mode — schema is created by db.create_all()).
# Run migrations only when a real database is configured.
if [ -n "$SQLALCHEMY_DATABASE_URI" ] || [ -n "$DB_HOST" ]; then
    echo "Running database migrations..."
    flask db upgrade
else
    echo "SQLite demo mode: skipping migrations."
fi

echo "Starting gunicorn..."
exec gunicorn --bind 0.0.0.0:8000 -w "${WORKERS:-1}" human_evaluation_tool:app

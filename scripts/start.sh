#!/bin/bash
set -e  # Exit immediately on error

# ----------------------
# Config
# ----------------------
DC="docker compose -f docker-compose.dev.yml"
APP_SERVICE="app"
DB_SERVICE="db"

# Load host env variables
export $(grep -v '^#' .env | xargs)  # optional: exports DATABASE_USER, DATABASE_NAME, etc.

# Ensure .env exists
if [ ! -f .env ]; then
  echo "❌ .env file not found. Please create one in project root."
  exit 1
fi

# ----------------------
# Build & start containers
# ----------------------
echo "🔹 Building Docker containers..."
$DC up -d --build

# ----------------------
# Wait for Postgres
# ----------------------
echo "🔹 Waiting for Postgres to be ready..."
MAX_RETRIES=30
count=0
until $DC exec -T $DB_SERVICE pg_isready -U "$DATABASE_USER" -d "$DATABASE_NAME" > /dev/null 2>&1; do
    count=$((count+1))
    if [ $count -ge $MAX_RETRIES ]; then
        echo "❌ Postgres did not become ready in time."
        exit 1
    fi
    echo "⏳ Waiting for database... ($count/$MAX_RETRIES)"
    sleep 2
done
echo "✅ Postgres is ready!"

# ----------------------
# Run Prisma migrations
# ----------------------
echo "🔹 Running Prisma migrations..."
$DC exec -T $APP_SERVICE npx prisma migrate deploy

# ----------------------
# Generate Prisma client
# ----------------------
echo "🔹 Generating Prisma client..."
$DC exec -T $APP_SERVICE npx prisma generate

# ----------------------
# Run Prisma seed
# ----------------------
echo "🔹 Running Prisma seed..."
$DC exec -T $APP_SERVICE npx prisma db seed

# ----------------------
# Tail app logs
# ----------------------
echo "🔹 All done! Showing app logs..."
$DC logs -f $APP_SERVICE

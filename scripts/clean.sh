#!/bin/bash

echo "Starting data cleaning on production D1 database (sih-app-db)..."
echo "Running clean.sql..."

# Run the SQL file against the remote D1 database
npx wrangler d1 execute sih-app-db --remote --file=clean.sql

echo "Data cleaning complete!"

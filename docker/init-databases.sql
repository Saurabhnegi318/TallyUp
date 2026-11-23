-- Initialize separate databases for Database-per-Service architecture
SELECT 'CREATE DATABASE group_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'group_db')\gexec

SELECT 'CREATE DATABASE expense_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'expense_db')\gexec

SELECT 'CREATE DATABASE settlement_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'settlement_db')\gexec

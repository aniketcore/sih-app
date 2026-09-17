-- 1. Drop unnecessary tables
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS team_invites;

-- 2. Remove admins from the database (from child tables first, then users)
-- NOTE: problem_statements is wrapped in a try/catch equivalent or you can safely ignore errors if the table doesn't exist.
DELETE FROM team_members WHERE user_id IN (SELECT id FROM users WHERE email IN (SELECT email FROM admins));
DELETE FROM users WHERE email IN (SELECT email FROM admins);

-- 3. Remove unnecessary users (not starting with "2026pcea") (from child tables first, then users)
DELETE FROM team_members WHERE user_id IN (SELECT id FROM users WHERE email NOT LIKE '2026pcea%');
DELETE FROM teams WHERE owner_uid IN (SELECT id FROM users WHERE email NOT LIKE '2026pcea%');
DELETE FROM fcfs_claims WHERE user_id IN (SELECT id FROM users WHERE email NOT LIKE '2026pcea%');
DELETE FROM users WHERE email NOT LIKE '2026pcea%';

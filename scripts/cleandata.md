## drop unnecessary tables

```sql
drop table settings;
drop table team_invites;
```

## remove admins from the database

### get user_ids of admins
```sql
SELECT id FROM users WHERE email IN (SELECT email FROM admins);
```

### remove from problem statements
```sql
DELETE FROM problem_statements WHERE user_id IN (SELECT id FROM users WHERE email IN (SELECT email FROM admins));
```

### remove from team_members
```sql
DELETE FROM team_members WHERE user_id IN (SELECT id FROM users WHERE email IN (SELECT email FROM admins));
```

### remove from users
```sql
DELETE FROM users WHERE email IN (SELECT email FROM admins);
```

## remove unnecessary users (not starting with "2026pcea")

### remove from team_members
```sql
DELETE FROM team_members WHERE user_id IN (SELECT id FROM users WHERE email NOT LIKE '2026pcea%');
```

### remove from teams
```sql
DELETE FROM teams WHERE owner_uid IN (SELECT id FROM users WHERE email NOT LIKE '2026pcea%');
```

### remove from fcfs_claims
```sql
DELETE FROM fcfs_claims WHERE user_id IN (SELECT id FROM users WHERE email NOT LIKE '2026pcea%');
```

### remove from problem_statements (if applicable)
```sql
DELETE FROM problem_statements WHERE user_id IN (SELECT id FROM users WHERE email NOT LIKE '2026pcea%');
```

### remove from users
```sql
DELETE FROM users WHERE email NOT LIKE '2026pcea%';
```
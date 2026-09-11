import Database from 'better-sqlite3';

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE team_members (
    team_id TEXT,
    user_id TEXT,
    email TEXT,
    photo_url TEXT,
    joined_at INTEGER,
    PRIMARY KEY (team_id, user_id)
  );
`);

// Insert 6 members
for (let i = 0; i < 6; i++) {
  db.prepare("INSERT INTO team_members VALUES ('team1', 'user' || ?, 'email' || ?, NULL, 123)").run(i, i);
}

// Try to insert 7th member conditionally
const stmt = db.prepare(`
  INSERT INTO team_members (team_id, user_id, email, photo_url, joined_at)
  SELECT ?, ?, ?, ?, ?
  WHERE (SELECT COUNT(*) FROM team_members WHERE team_id = ?) < 6
  ON CONFLICT(team_id, user_id) DO UPDATE SET email = excluded.email
`);

const res = stmt.run('team1', 'user7', 'email7', null, 123, 'team1');
console.log('Changes for 7th member:', res.changes);

// Try to update an existing conditionally (should it work? count is 6, so WHERE is false, it won't even evaluate conflict!)
const res2 = stmt.run('team1', 'user0', 'new-email0', null, 123, 'team1');
console.log('Changes for update when full:', res2.changes);


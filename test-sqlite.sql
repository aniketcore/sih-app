CREATE TABLE team_members (
  team_id TEXT,
  user_id TEXT,
  email TEXT,
  photo_url TEXT,
  joined_at INTEGER,
  PRIMARY KEY (team_id, user_id)
);
INSERT INTO team_members VALUES ('team1', 'user0', 'e0', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user1', 'e1', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user2', 'e2', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user3', 'e3', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user4', 'e4', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user5', 'e5', NULL, 123);
.changes on
INSERT INTO team_members (team_id, user_id, email, photo_url, joined_at)
SELECT 'team1', 'user7', 'e7', NULL, 123
WHERE (SELECT COUNT(*) FROM team_members WHERE team_id = 'team1') < 6
ON CONFLICT(team_id, user_id) DO UPDATE SET email = excluded.email;

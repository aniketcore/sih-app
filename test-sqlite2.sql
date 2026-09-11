CREATE TABLE team_members (
  team_id TEXT,
  user_id TEXT,
  email TEXT,
  photo_url TEXT,
  joined_at INTEGER,
  PRIMARY KEY (team_id, user_id)
);
CREATE TRIGGER enforce_team_limit
BEFORE INSERT ON team_members
FOR EACH ROW
WHEN (SELECT COUNT(*) FROM team_members WHERE team_id = NEW.team_id) >= 6
BEGIN
  SELECT RAISE(ABORT, 'Team is already full (maximum 6 members)');
END;

INSERT INTO team_members VALUES ('team1', 'user0', 'e0', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user1', 'e1', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user2', 'e2', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user3', 'e3', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user4', 'e4', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user5', 'e5', NULL, 123);
INSERT INTO team_members VALUES ('team1', 'user6', 'e6', NULL, 123);

-- ============================================================
-- NHL
-- ============================================================

-- Atlantic (Eastern Conference)
UPDATE teams SET conf = 'east', division = 'atlantic'
  WHERE league = 'nhl' AND espnid IN (1, 2, 5, 26, 10, 14, 20, 21);

-- Metropolitan (Eastern Conference)
UPDATE teams SET conf = 'east', division = 'metropolitan'
  WHERE league = 'nhl' AND espnid IN (7, 29, 11, 12, 13, 15, 16, 23);

-- Central (Western Conference)
-- Includes Arizona Coyotes (espnid=24, defunct) for historical season accuracy
UPDATE teams SET conf = 'west', division = 'central'
  WHERE league = 'nhl' AND espnid IN (4, 17, 9, 30, 27, 19, 129764, 28, 24);

-- Pacific (Western Conference)
UPDATE teams SET conf = 'west', division = 'pacific'
  WHERE league = 'nhl' AND espnid IN (25, 3, 6, 8, 18, 124292, 22, 37);

-- ============================================================
-- NBA
-- ============================================================

-- Atlantic (Eastern Conference)
-- Boston Celtics, Brooklyn Nets, New York Knicks, Philadelphia 76ers, Toronto Raptors
UPDATE teams SET conf = 'east', division = 'atlantic'
  WHERE league = 'nba' AND espnid IN (2, 17, 18, 20, 28);

-- Central (Eastern Conference)
-- Chicago Bulls, Cleveland Cavaliers, Detroit Pistons, Indiana Pacers, Milwaukee Bucks
UPDATE teams SET conf = 'east', division = 'central'
  WHERE league = 'nba' AND espnid IN (4, 5, 8, 11, 15);

-- Southeast (Eastern Conference)
-- Atlanta Hawks, Charlotte Hornets, Miami Heat, Orlando Magic, Washington Wizards
UPDATE teams SET conf = 'east', division = 'southeast'
  WHERE league = 'nba' AND espnid IN (1, 30, 14, 19, 27);

-- Northwest (Western Conference)
-- Denver Nuggets, Minnesota Timberwolves, Oklahoma City Thunder, Portland Trail Blazers, Utah Jazz
UPDATE teams SET conf = 'west', division = 'northwest'
  WHERE league = 'nba' AND espnid IN (7, 16, 25, 22, 26);

-- Pacific (Western Conference)
-- Golden State Warriors, LA Clippers, Los Angeles Lakers, Phoenix Suns, Sacramento Kings
UPDATE teams SET conf = 'west', division = 'pacific'
  WHERE league = 'nba' AND espnid IN (9, 12, 13, 21, 23);

-- Southwest (Western Conference)
-- Dallas Mavericks, Houston Rockets, Memphis Grizzlies, New Orleans Pelicans, San Antonio Spurs
UPDATE teams SET conf = 'west', division = 'southwest'
  WHERE league = 'nba' AND espnid IN (6, 10, 29, 3, 24);

-- ============================================================
-- NFL
-- ============================================================

-- AFC East
-- Buffalo Bills, Miami Dolphins, New England Patriots, New York Jets
UPDATE teams SET conf = 'afc', division = 'afc_east'
  WHERE league = 'nfl' AND espnid IN (2, 15, 17, 20);

-- AFC North
-- Baltimore Ravens, Cincinnati Bengals, Cleveland Browns, Pittsburgh Steelers
UPDATE teams SET conf = 'afc', division = 'afc_north'
  WHERE league = 'nfl' AND espnid IN (33, 4, 5, 23);

-- AFC South
-- Houston Texans, Indianapolis Colts, Jacksonville Jaguars, Tennessee Titans
UPDATE teams SET conf = 'afc', division = 'afc_south'
  WHERE league = 'nfl' AND espnid IN (34, 11, 30, 10);

-- AFC West
-- Denver Broncos, Kansas City Chiefs, Las Vegas Raiders, Los Angeles Chargers
UPDATE teams SET conf = 'afc', division = 'afc_west'
  WHERE league = 'nfl' AND espnid IN (7, 12, 13, 24);

-- NFC East
-- Dallas Cowboys, New York Giants, Philadelphia Eagles, Washington Commanders
UPDATE teams SET conf = 'nfc', division = 'nfc_east'
  WHERE league = 'nfl' AND espnid IN (6, 19, 21, 28);

-- NFC North
-- Chicago Bears, Detroit Lions, Green Bay Packers, Minnesota Vikings
UPDATE teams SET conf = 'nfc', division = 'nfc_north'
  WHERE league = 'nfl' AND espnid IN (3, 8, 9, 16);

-- NFC South
-- Atlanta Falcons, Carolina Panthers, New Orleans Saints, Tampa Bay Buccaneers
UPDATE teams SET conf = 'nfc', division = 'nfc_south'
  WHERE league = 'nfl' AND espnid IN (1, 29, 18, 27);

-- NFC West
-- Arizona Cardinals, Los Angeles Rams, San Francisco 49ers, Seattle Seahawks
UPDATE teams SET conf = 'nfc', division = 'nfc_west'
  WHERE league = 'nfl' AND espnid IN (22, 14, 25, 26);

  const commonMappings = {
    'points': ['points', 'pts', `PTS`],
    'assists': ['assists', 'a', 'AST'],
    'rebounds': ['rebounds', 'REB', 'total_rebounds'],
    'blocks': ['blocks', 'BLK', 'blocked_shots'],
    'steals': ['steals', 'STL'],
    'turnovers': ['turnovers', 'TO', 'giveaways'],
    'plusminus': ['plusminus', 'plus_minus', '+/-'],
    'minutes': ['minutes', 'MIN', 'toi'],
    'fouls': ['PF', 'fouls'], 
    fg:    [ "fgPct", "fieldGoalPercentage", "FG" ],
  threept: [ "threePointFieldGoalsMade", "3FGM", "3PT" ],
  ft:    [ "freeThrowPercentage", "FT" ],
  };

  export default commonMappings;
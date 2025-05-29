const mockNhlStats = [
  {
    id: 500,
    name: "Igor Shesterkin",
    team: "Rangers",
    position: "G",
    season: "2024-2025",
    height: "6'1\"",
    image: "https://assets.nhle.com/mugs/nhl/20232024/NYR/19250.png",
    averages: {
      G: 0,
      A: 0,
      pts: 0,
      plusMinus: 20,
      saves: 11,
      savePct: 67,
        GAA: 22
    },
    recentGames: [
      {
        id: 99,
        date: "2025-10-05",
        opponent: "Pittsburgh Penguins",
        G: 0,
        A: 0,
        SAVES: 3,
        plusMinus: 1,
        TOI: 23,
        SHOTS: 1,
        SM: 1,
        BS: 0,
        PN: 3,
        PIM: 2, 
        HT: 1,
        TK: 0,
        GV: 0
      }
    ]
  }
];

export default mockNhlStats;

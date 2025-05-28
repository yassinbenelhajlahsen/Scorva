const mockNbaTeams = [
  {
    id: 1,
    name: "Atlanta Hawks",
    city: "Atlanta",
    arena: "State Farm Arena",
    logo: "https://upload.wikimedia.org/wikipedia/en/2/24/Atlanta_Hawks_logo.svg",
    record: "0-0",
  },
  {
    id: 2,
    name: "Boston Celtics",
    
    city: "Boston",
    arena: "TD Garden",
    logo: "https://upload.wikimedia.org/wikipedia/en/8/8f/Boston_Celtics.svg",
    record: "2-0",
  },
  {
    id: 3,
    name: "Brooklyn Nets",
    city: "Brooklyn",
    arena: "Barclays Center",
    logo: "https://upload.wikimedia.org/wikipedia/commons/4/44/Brooklyn_Nets_newlogo.svg"
  },
  {
    id: 4,
    name: "Charlotte Hornets",
    city: "Charlotte",
    arena: "Spectrum Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/c/c4/Charlotte_Hornets_%282014%29.svg"
  },
  {
    id: 5,
    name: "Chicago Bulls",
    city: "Chicago",
    arena: "United Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/6/67/Chicago_Bulls_logo.svg"
  },
  {
    id: 6,
    name: "Cleveland Cavaliers",
    city: "Cleveland",
    arena: "Rocket Mortgage FieldHouse",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Cleveland_Cavaliers_logo.svg/1189px-Cleveland_Cavaliers_logo.svg.png"
  },
  {
    id: 7,
    name: "Dallas Mavericks",
    city: "Dallas",
    arena: "American Airlines Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/9/97/Dallas_Mavericks_logo.svg"
  },
  {
    id: 8,
    name: "Denver Nuggets",
    city: "Denver",
    arena: "Ball Arena",
    logo: "https://upload.wikimedia.org/wikipedia/en/7/76/Denver_Nuggets.svg"
  },
  {
    id: 9,
    name: "Detroit Pistons",
    city: "Detroit",
    arena: "Little Caesars Arena",
    logo: "https://cdn.freebiesupply.com/images/large/2x/detroit-pistons-logo-transparent.png"
  },
  {
    id: 10,
    name: "Golden State Warriors",
    shortName: "Warriors",
    city: "San Francisco",
    arena: "Chase Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/0/01/Golden_State_Warriors_logo.svg",
    coach: "Steve Kerr"
  },
  {
    id: 11,
    name: "Houston Rockets",
    city: "Houston",
    arena: "Toyota Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/2/28/Houston_Rockets.svg"
  },
  {
    id: 12,
    name: "Indiana Pacers",
    city: "Indianapolis",
    arena: "Gainbridge Fieldhouse",
    logo: "https://upload.wikimedia.org/wikipedia/en/1/1b/Indiana_Pacers.svg"
  },
  {
    id: 13,
    name: "Los Angeles Clippers",
    city: "Los Angeles",
    arena: "Crypto.com Arena",
    logo: "https://upload.wikimedia.org/wikipedia/en/b/bb/Los_Angeles_Clippers_%282015%29.svg"
  },
  {
    id: 14,
    name: "Los Angeles Lakers",
    shortName: "lakers",
    city: "Los Angeles",
    arena: "Crypto.com Arena",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/3c/Los_Angeles_Lakers_logo.svg",
    coach: "JJ Reddick",
    record: "51-31",
    location: "Los Angeles, Californa"
  },
  {
    id: 15,
    name: "Memphis Grizzlies",
    city: "Memphis",
    arena: "FedExForum",
    logo: "https://upload.wikimedia.org/wikipedia/en/f/f1/Memphis_Grizzlies.svg"
  },
  {
    id: 16,
    name: "Miami Heat",
    city: "Miami",
    arena: "Kaseya Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/f/fb/Miami_Heat_logo.svg"
  },
  {
    id: 17,
    name: "Milwaukee Bucks",
    shortName: "Bucks",
    city: "Milwaukee",
    arena: "Fiserv Forum",
    logo: "https://upload.wikimedia.org/wikipedia/en/4/4a/Milwaukee_Bucks_logo.svg"
  },
  {
    id: 18,
    name: "Minnesota Timberwolves",
    city: "Minneapolis",
    arena: "Target Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/c/c2/Minnesota_Timberwolves_logo.svg"
  },
  {
    id: 19,
    name: "New Orleans Pelicans",
    city: "New Orleans",
    arena: "Smoothie King Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/0/0d/New_Orleans_Pelicans_logo.svg"
  },
  {
    id: 20,
    name: "New York Knicks",
    city: "New York",
    arena: "Madison Square Garden",
    logo: "https://upload.wikimedia.org/wikipedia/en/2/25/New_York_Knicks_logo.svg"
  },
  {
    id: 21,
    name: "Oklahoma City Thunder",
    city: "Oklahoma City",
    arena: "Paycom Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/5/5d/Oklahoma_City_Thunder.svg"
  },
  {
    id: 22,
    name: "Orlando Magic",
    city: "Orlando",
    arena: "Amway Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/1/10/Orlando_Magic_logo.svg"
  },
  {
    id: 23,
    name: "Philadelphia 76ers",
    city: "Philadelphia",
    arena: "Wells Fargo Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/0/0e/Philadelphia_76ers_logo.svg"
  },
  {
    id: 24,
    name: "Phoenix Suns",
    city: "Phoenix",
    arena: "Footprint Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/d/dc/Phoenix_Suns_logo.svg"
  },
  {
    id: 25,
    name: "Portland Trail Blazers",
    city: "Portland",
    arena: "Moda Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/2/21/Portland_Trail_Blazers_logo.svg"
  },
  {
    id: 26,
    name: "Sacramento Kings",
    city: "Sacramento",
    arena: "Golden 1 Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/c/c7/SacramentoKings.svg"
  },
  {
    id: 27,
    name: "San Antonio Spurs",
    city: "San Antonio",
    arena: "Frost Bank Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/a/a2/San_Antonio_Spurs.svg"
  },
  {
    id: 28,
    name: "Toronto Raptors",
    city: "Toronto",
    arena: "Scotiabank Arena",
    logo: "https://upload.wikimedia.org/wikipedia/en/3/36/Toronto_Raptors_logo.svg"
  },
  {
    id: 29,
    name: "Utah Jazz",
    city: "Salt Lake City",
    arena: "Delta Center",
    logo: "https://upload.wikimedia.org/wikipedia/en/5/52/Utah_Jazz_logo_2022.svg"
  },
  {
    id: 30,
    name: "Washington Wizards",
    city: "Washington, D.C.",
    arena: "Capital One Arena",
    logo: "https://upload.wikimedia.org/wikipedia/en/0/02/Washington_Wizards_logo.svg"
  }
];

export default mockNbaTeams;
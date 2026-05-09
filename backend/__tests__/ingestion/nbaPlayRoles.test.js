import { inferParticipantRoles } from "../../src/ingestion/mappings/nbaPlayRoles.js";

describe("inferParticipantRoles", () => {
  test("made shot with assist", () => {
    const play = {
      type: { text: "Jump Shot" },
      text: "Dean Wade makes 24-foot three point jumper (Evan Mobley assists)",
      scoringPlay: true,
      shootingPlay: true,
      participants: [{ athlete: { id: "3912848" } }, { athlete: { id: "4432158" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "3912848", role: "scorer" },
      { espnAthleteId: "4432158", role: "assister" },
    ]);
  });

  test("made shot without assist", () => {
    const play = {
      type: { text: "Driving Layup Shot" },
      text: "Donovan Mitchell makes running layup",
      scoringPlay: true,
      shootingPlay: true,
      participants: [{ athlete: { id: "3908809" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "3908809", role: "scorer" },
    ]);
  });

  test("missed shot with block — primary actor is shot_attempter, secondary is blocker", () => {
    const play = {
      type: { text: "Pullup Jump Shot" },
      text: "Max Strus blocks Daniss Jenkins 's 27-foot three point pullup jump shot",
      scoringPlay: false,
      shootingPlay: true,
      participants: [{ athlete: { id: "5107199" } }, { athlete: { id: "4065778" } }],
    };
    // p[0] is shooter (Jenkins), p[1] is blocker (Strus) — confirmed by name lookup
    // in spec verification (see spec section "Role inference table").
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "5107199", role: "shot_attempter" },
      { espnAthleteId: "4065778", role: "blocker" },
    ]);
  });

  test("missed shot without block", () => {
    const play = {
      type: { text: "Floating Jump Shot" },
      text: "Jarrett Allen misses 7-foot floating jump shot",
      scoringPlay: false,
      shootingPlay: true,
      participants: [{ athlete: { id: "4066328" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "4066328", role: "shot_attempter" },
    ]);
  });

  test("free throw made", () => {
    const play = {
      type: { text: "Free Throw - 1 of 1" },
      text: "Jaylon Tyson makes free throw 1 of 1",
      scoringPlay: true,
      shootingPlay: true,
      participants: [{ athlete: { id: "4683747" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "4683747", role: "scorer" },
    ]);
  });

  test("free throw missed", () => {
    const play = {
      type: { text: "Free Throw - 2 of 2" },
      text: "Player misses free throw 2 of 2",
      scoringPlay: false,
      shootingPlay: true,
      participants: [{ athlete: { id: "1" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "1", role: "shot_attempter" },
    ]);
  });

  test("defensive rebound", () => {
    const play = {
      type: { text: "Defensive Rebound" },
      text: "Tobias Harris defensive rebound",
      participants: [{ athlete: { id: "6440" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "6440", role: "rebounder" },
    ]);
  });

  test("offensive rebound", () => {
    const play = {
      type: { text: "Offensive Rebound" },
      text: "Player offensive rebound",
      participants: [{ athlete: { id: "1" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "1", role: "rebounder" },
    ]);
  });

  test("turnover with steal — primary actor is committer, secondary is stealer", () => {
    const play = {
      type: { text: "Lost Ball Turnover" },
      text: "Evan Mobley lost ball turnover (Tobias Harris steals)",
      participants: [{ athlete: { id: "4432158" } }, { athlete: { id: "6440" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "4432158", role: "turnover_committer" },
      { espnAthleteId: "6440", role: "stealer" },
    ]);
  });

  test("turnover without steal", () => {
    const play = {
      type: { text: "Out of Bounds - Bad Pass Turnover" },
      text: "Player out of bounds turnover",
      participants: [{ athlete: { id: "1" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "1", role: "turnover_committer" },
    ]);
  });

  test("normalizes newline in type.text (e.g., 'Bad Pass\\nTurnover')", () => {
    const play = {
      type: { text: "Bad Pass\nTurnover" },
      text: "Jarrett Allen bad pass\nturnover (Duncan Robinson steals)",
      participants: [{ athlete: { id: "4066328" } }, { athlete: { id: "3157465" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "4066328", role: "turnover_committer" },
      { espnAthleteId: "3157465", role: "stealer" },
    ]);
  });

  test("personal foul", () => {
    const play = {
      type: { text: "Personal Foul" },
      text: "Cade Cunningham personal foul",
      participants: [{ athlete: { id: "4432166" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "4432166", role: "foul_committer" },
    ]);
  });

  test("shooting foul", () => {
    const play = {
      type: { text: "Shooting Foul" },
      text: "Player shooting foul",
      participants: [{ athlete: { id: "1" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "1", role: "foul_committer" },
    ]);
  });

  test("substitution returns empty (not rated)", () => {
    const play = {
      type: { text: "Substitution" },
      text: "Player A enters for Player B",
      participants: [{ athlete: { id: "1" } }, { athlete: { id: "2" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([]);
  });

  test("end period returns empty", () => {
    const play = { type: { text: "End Period" }, text: "End of 1st quarter", participants: [] };
    expect(inferParticipantRoles(play)).toEqual([]);
  });

  test("missing participants array returns empty", () => {
    const play = { type: { text: "Jump Shot" }, text: "Made jumper", scoringPlay: true, shootingPlay: true };
    expect(inferParticipantRoles(play)).toEqual([]);
  });

  test("unknown play type returns empty (defensive default)", () => {
    const play = {
      type: { text: "Unknown Mystery Play" },
      text: "?",
      participants: [{ athlete: { id: "1" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([]);
  });

  test("offensive charge with both participants → committer + charge_drawer", () => {
    const play = {
      type: { text: "Offensive Charge" },
      text: "Player A offensive charge (Player B draws the foul)",
      scoringPlay: false,
      participants: [{ athlete: { id: "111" } }, { athlete: { id: "222" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "111", role: "turnover_committer" },
      { espnAthleteId: "222", role: "charge_drawer" },
    ]);
  });

  test("offensive charge with only one participant → committer only", () => {
    const play = {
      type: { text: "Offensive Charge" },
      text: "Player A offensive charge",
      scoringPlay: false,
      participants: [{ athlete: { id: "111" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "111", role: "turnover_committer" },
    ]);
  });

  test("offensive charge with 'steals' word in text → still charge_drawer (not stealer)", () => {
    // Defensive: a charge can't also be a steal, but verify the charge branch
    // bypasses the steal-text check that lives in the turnover branch.
    const play = {
      type: { text: "Offensive Charge" },
      text: "Player A offensive charge — Player B steals the moment",
      scoringPlay: false,
      participants: [{ athlete: { id: "111" } }, { athlete: { id: "222" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "111", role: "turnover_committer" },
      { espnAthleteId: "222", role: "charge_drawer" },
    ]);
  });

  test("offensive foul turnover with both participants → committer + charge_drawer", () => {
    const play = {
      type: { text: "Offensive Foul Turnover" },
      text: "Player A offensive foul turnover",
      scoringPlay: false,
      participants: [{ athlete: { id: "111" } }, { athlete: { id: "222" } }],
    };
    expect(inferParticipantRoles(play)).toEqual([
      { espnAthleteId: "111", role: "turnover_committer" },
      { espnAthleteId: "222", role: "charge_drawer" },
    ]);
  });
});

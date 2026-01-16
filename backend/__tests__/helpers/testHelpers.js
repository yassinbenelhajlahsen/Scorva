/**
 * Test Helpers and Utilities
 *
 * Provides common utilities for testing backend services and routes.
 */

import { jest } from "@jest/globals";

/**
 * Mock database pool for testing
 */
export const createMockPool = () => {
  const mockQuery = jest.fn();

  return {
    query: mockQuery,
    connect: jest.fn().mockResolvedValue({
      query: mockQuery,
      release: jest.fn(),
    }),
    end: jest.fn(),
  };
};

/**
 * Sample test data generators
 */
export const fixtures = {
  team: (overrides = {}) => ({
    id: 1,
    name: "Los Angeles Lakers",
    shortname: "LAL",
    location: "Los Angeles",
    conf: "Western",
    logo_url: "https://example.com/lal.png",
    record: "25-15",
    homerecord: "15-5",
    awayrecord: "10-10",
    league: "nba",
    ...overrides,
  }),

  player: (overrides = {}) => ({
    id: 1,
    name: "LeBron James",
    teamid: 1,
    position: "F",
    height: "6-9",
    weight: "250",
    jerseynum: "23",
    dob: "1984-12-30",
    image_url: "https://example.com/lebron.jpg",
    espn_playerid: "1966",
    league: "nba",
    slug: "lebron-james",
    draftinfo: "Round 1, Pick 1, 2003",
    ...overrides,
  }),

  game: (overrides = {}) => ({
    id: 1,
    league: "nba",
    date: "2025-01-15",
    hometeamid: 1,
    awayteamid: 2,
    homescore: 110,
    awayscore: 105,
    venue: "Crypto.com Arena",
    status: "Final",
    season: "2025-26",
    winnerid: 1,
    broadcast: "ESPN",
    firstqtr: "28-25",
    secondqtr: "27-30",
    thirdqtr: "30-25",
    fourthqtr: "25-25",
    ot1: null,
    ot2: null,
    ot3: null,
    ot4: null,
    ai_summary: null,
    ...overrides,
  }),

  stat: (overrides = {}) => ({
    id: 1,
    gameid: 1,
    playerid: 1,
    points: 28,
    assists: 7,
    rebounds: 8,
    blocks: 1,
    steals: 2,
    fouls: 3,
    minutes: "35:24",
    turnovers: 3,
    plusminus: "+12",
    fg: "10-18",
    threept: "3-7",
    ft: "5-6",
    ...overrides,
  }),
};

/**
 * Create mock request object
 */
export const mockRequest = (overrides = {}) => ({
  params: {},
  query: {},
  body: {},
  headers: {},
  ...overrides,
});

/**
 * Create mock response object
 */
export const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Helper to wait for async operations
 */
export const waitFor = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

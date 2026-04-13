import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockGetHeadToHead = jest.fn();

const servicePath = resolve(__dirname, "../../src/services/meta/headToHeadService.js");
jest.unstable_mockModule(servicePath, () => ({
  getHeadToHead: mockGetHeadToHead,
}));

const controllerPath = resolve(__dirname, "../../src/controllers/meta/headToHeadController.js");
const { headToHead } = await import(controllerPath);

function makeReq(params = {}, query = {}) {
  return { params, query };
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  return res;
}

describe("headToHeadController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 for invalid league", async () => {
    const req = makeReq({ league: "mlb" }, { type: "teams", ids: "1,2" });
    const res = makeRes();

    await headToHead(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid league" });
  });

  it("returns 400 for missing type", async () => {
    const req = makeReq({ league: "nba" }, { ids: "1,2" });
    const res = makeRes();

    await headToHead(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("type") }));
  });

  it("returns 400 for invalid type", async () => {
    const req = makeReq({ league: "nba" }, { type: "games", ids: "1,2" });
    const res = makeRes();

    await headToHead(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when ids has only one value", async () => {
    const req = makeReq({ league: "nba" }, { type: "teams", ids: "1" });
    const res = makeRes();

    await headToHead(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("2") }));
  });

  it("returns 400 when ids is missing", async () => {
    const req = makeReq({ league: "nba" }, { type: "teams" });
    const res = makeRes();

    await headToHead(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when ids contains non-numeric values", async () => {
    const req = makeReq({ league: "nba" }, { type: "teams", ids: "abc,def" });
    const res = makeRes();

    await headToHead(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("calls service and returns games for valid team request", async () => {
    const mockGames = [{ id: 1, date: "2025-01-10" }];
    mockGetHeadToHead.mockResolvedValueOnce(mockGames);

    const req = makeReq({ league: "nba" }, { type: "teams", ids: "1,2" });
    const res = makeRes();

    await headToHead(req, res);

    expect(mockGetHeadToHead).toHaveBeenCalledWith("nba", "teams", 1, 2);
    expect(res.json).toHaveBeenCalledWith({ games: mockGames });
  });

  it("calls service with player type", async () => {
    mockGetHeadToHead.mockResolvedValueOnce([]);

    const req = makeReq({ league: "nfl" }, { type: "players", ids: "10,20" });
    const res = makeRes();

    await headToHead(req, res);

    expect(mockGetHeadToHead).toHaveBeenCalledWith("nfl", "players", 10, 20);
    expect(res.json).toHaveBeenCalledWith({ games: [] });
  });

  it("returns 500 on service error", async () => {
    mockGetHeadToHead.mockRejectedValueOnce(new Error("DB down"));

    const req = makeReq({ league: "nba" }, { type: "teams", ids: "1,2" });
    const res = makeRes();

    await headToHead(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Server error" });
  });

  it("normalizes league to lowercase", async () => {
    mockGetHeadToHead.mockResolvedValueOnce([]);

    const req = makeReq({ league: "NBA" }, { type: "teams", ids: "1,2" });
    const res = makeRes();

    await headToHead(req, res);

    expect(mockGetHeadToHead).toHaveBeenCalledWith("nba", "teams", 1, 2);
  });
});

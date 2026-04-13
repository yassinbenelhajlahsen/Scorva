import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Mocks ---

const mockCreate = jest.fn();

jest.unstable_mockModule("openai", () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

const mockExecuteTool = jest.fn();
jest.unstable_mockModule(resolve(__dirname, "../../src/services/ai/chat/toolsService.js"), () => ({
  TOOL_DEFINITIONS: [],
  executeTool: mockExecuteTool,
}));

const mockPool = createMockPool();
jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({
  default: mockPool,
}));

const mockGetPlayerIdBySlug = jest.fn();
jest.unstable_mockModule(resolve(__dirname, "../../src/utils/slugResolver.js"), () => ({
  getPlayerIdBySlug: mockGetPlayerIdBySlug,
}));

jest.unstable_mockModule(resolve(__dirname, "../../src/logger.js"), () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const servicePath = resolve(__dirname, "../../src/services/ai/chat/agentService.js");
const { runAgentLoop, summarizeOlderMessages } = await import(servicePath);

// --- Helpers ---

async function* fakeStream(chunks) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function contentChunk(text) {
  return { choices: [{ delta: { content: text } }] };
}

function toolCallChunk(index, id, name, args) {
  return {
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index,
              id,
              function: { name, arguments: args },
            },
          ],
        },
      },
    ],
  };
}

function emptyChunk() {
  return { choices: [{ delta: {} }] };
}

describe("chatAgentService — runAgentLoop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  it("streams final answer via onDelta when no tool calls", async () => {
    mockCreate.mockReturnValueOnce(
      fakeStream([contentChunk("LeBron is scoring "), contentChunk("28 points.")])
    );

    const deltas = [];
    const result = await runAgentLoop(
      [{ role: "user", content: "How is LeBron?" }],
      null,
      (d) => deltas.push(d)
    );

    expect(deltas).toEqual(["LeBron is scoring 28 points."]);
    expect(result).toBe("LeBron is scoring 28 points.");
  });

  it("returns empty string when model produces no content", async () => {
    mockCreate.mockReturnValueOnce(fakeStream([emptyChunk()]));

    const result = await runAgentLoop([], null, () => {});

    expect(result).toBe("");
  });

  it("executes tool calls and feeds results back before final answer", async () => {
    mockExecuteTool.mockResolvedValueOnce({ leaders: [{ name: "LeBron" }] });

    mockCreate
      .mockReturnValueOnce(
        fakeStream([
          toolCallChunk(0, "call-1", "get_stat_leaders", '{"league":"nba","stat":"points"}'),
        ])
      )
      .mockReturnValueOnce(fakeStream([contentChunk("LeBron leads in scoring.")]));

    const deltas = [];
    const result = await runAgentLoop(
      [{ role: "user", content: "Who leads in points?" }],
      null,
      (d) => deltas.push(d)
    );

    expect(mockExecuteTool).toHaveBeenCalledWith("get_stat_leaders", {
      league: "nba",
      stat: "points",
    });
    expect(result).toBe("LeBron leads in scoring.");
  });

  it("executes multiple tool calls in the same round", async () => {
    mockExecuteTool
      .mockResolvedValueOnce({ player: "LeBron" })
      .mockResolvedValueOnce({ player: "Curry" });

    mockCreate
      .mockReturnValueOnce(
        fakeStream([
          toolCallChunk(0, "call-1", "get_player_detail", '{"league":"nba","playerId":1}'),
          toolCallChunk(1, "call-2", "get_player_detail", '{"league":"nba","playerId":2}'),
        ])
      )
      .mockReturnValueOnce(fakeStream([contentChunk("Comparison done.")]));

    await runAgentLoop([], null, () => {});

    expect(mockExecuteTool).toHaveBeenCalledTimes(2);
  });

  it("limits tool rounds to MAX_TOOL_ROUNDS (5) and then stops", async () => {
    // Every round returns a tool call — loop should stop after 5 rounds
    for (let i = 0; i < 5; i++) {
      mockCreate.mockReturnValueOnce(
        fakeStream([toolCallChunk(0, `call-${i}`, "search", '{"term":"test"}')])
      );
      mockExecuteTool.mockResolvedValueOnce({ results: [] });
    }

    const result = await runAgentLoop([], null, () => {});

    expect(mockCreate).toHaveBeenCalledTimes(5);
    expect(result).toBe("");
  });

  it("handles tool execution errors gracefully", async () => {
    mockExecuteTool.mockRejectedValueOnce(new Error("DB connection failed"));

    mockCreate
      .mockReturnValueOnce(
        fakeStream([toolCallChunk(0, "call-1", "get_games", '{"league":"nba"}')])
      )
      .mockReturnValueOnce(fakeStream([contentChunk("Sorry, had an issue.")]));

    const result = await runAgentLoop([], null, () => {});

    // Should recover and produce a final answer
    expect(result).toBe("Sorry, had an issue.");
    // Tool result message should contain the error
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    const toolMsg = secondCallMessages.find((m) => m.role === "tool");
    expect(JSON.parse(toolMsg.content)).toHaveProperty("error");
  });

  it("resolves page context for player pages", async () => {
    mockGetPlayerIdBySlug.mockResolvedValueOnce(1);
    mockPool.query.mockResolvedValueOnce({ rows: [{ name: "LeBron James" }] });
    mockCreate.mockReturnValueOnce(fakeStream([contentChunk("LeBron stats.")]));

    await runAgentLoop(
      [],
      { type: "player", league: "nba", playerSlug: "lebron-james" },
      () => {}
    );

    const systemMsg = mockCreate.mock.calls[0][0].messages[0];
    expect(systemMsg.content).toContain("LeBron James");
    expect(systemMsg.content).toContain("NBA");
  });

  it("resolves page context for team pages", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: "Los Angeles Lakers" }] });
    mockCreate.mockReturnValueOnce(fakeStream([contentChunk("Lakers info.")]));

    await runAgentLoop(
      [],
      { type: "team", league: "nba", teamSlug: "los-angeles-lakers" },
      () => {}
    );

    const systemMsg = mockCreate.mock.calls[0][0].messages[0];
    expect(systemMsg.content).toContain("Los Angeles Lakers");
  });

  it("resolves page context for game pages", async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ id: 100, home: "Lakers", away: "Celtics" }],
    });
    mockCreate.mockReturnValueOnce(fakeStream([contentChunk("Game info.")]));

    await runAgentLoop([], { type: "game", gameId: 100 }, () => {});

    const systemMsg = mockCreate.mock.calls[0][0].messages[0];
    expect(systemMsg.content).toContain("Celtics at Lakers");
  });

  it("adds league context block for league-type pageContext", async () => {
    mockCreate.mockReturnValueOnce(fakeStream([contentChunk("NBA info.")]));

    await runAgentLoop([], { type: "league", league: "nba" }, () => {});

    const systemMsg = mockCreate.mock.calls[0][0].messages[0];
    expect(systemMsg.content).toContain("NBA");
  });

  it("handles null pageContext without error", async () => {
    mockCreate.mockReturnValueOnce(fakeStream([contentChunk("General answer.")]));

    const result = await runAgentLoop([], null, () => {});

    expect(result).toBe("General answer.");
  });

  it("handles resolveContextEntity failure gracefully (entity is null)", async () => {
    mockGetPlayerIdBySlug.mockRejectedValueOnce(new Error("slug lookup failed"));
    mockCreate.mockReturnValueOnce(fakeStream([contentChunk("Fallback answer.")]));

    const result = await runAgentLoop(
      [],
      { type: "player", league: "nba", playerSlug: "some-player" },
      () => {}
    );

    expect(result).toBe("Fallback answer.");
    // System prompt should not crash — context block omitted when entity is null
    const systemMsg = mockCreate.mock.calls[0][0].messages[0];
    expect(systemMsg.role).toBe("system");
  });

  it("includes today's date in the system prompt", async () => {
    mockCreate.mockReturnValueOnce(fakeStream([contentChunk("Answer.")]));

    await runAgentLoop([], null, () => {});

    const systemMsg = mockCreate.mock.calls[0][0].messages[0];
    const currentYear = new Date().getFullYear().toString();
    expect(systemMsg.content).toContain(currentYear);
  });

  it("includes conversation history in messages sent to OpenAI", async () => {
    mockCreate.mockReturnValueOnce(fakeStream([contentChunk("Answer.")]));

    const history = [
      { role: "user", content: "First question" },
      { role: "assistant", content: "First answer" },
    ];
    await runAgentLoop(history, null, () => {});

    const messages = mockCreate.mock.calls[0][0].messages;
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "First question" }),
        expect.objectContaining({ role: "assistant", content: "First answer" }),
      ])
    );
  });

  it("calls onStatus with friendly label when tools are invoked", async () => {
    mockExecuteTool.mockResolvedValueOnce({ leaders: [] });
    mockCreate
      .mockReturnValueOnce(
        fakeStream([toolCallChunk(0, "call-1", "get_standings", '{"league":"nba"}')])
      )
      .mockReturnValueOnce(fakeStream([contentChunk("Eastern leads.")]));

    const onStatus = jest.fn();
    await runAgentLoop([], null, () => {}, { onStatus });

    expect(onStatus).toHaveBeenCalledWith("Checking standings");
  });

  it("calls onStatus with joined labels when multiple tools invoked in one round", async () => {
    mockExecuteTool
      .mockResolvedValueOnce({ player: "LeBron" })
      .mockResolvedValueOnce({ player: "Curry" });
    mockCreate
      .mockReturnValueOnce(
        fakeStream([
          toolCallChunk(0, "c1", "get_player_detail", '{"league":"nba","playerId":1}'),
          toolCallChunk(1, "c2", "get_player_comparison", '{"league":"nba","playerId1":1,"playerId2":2}'),
        ])
      )
      .mockReturnValueOnce(fakeStream([contentChunk("Done.")]));

    const onStatus = jest.fn();
    await runAgentLoop([], null, () => {}, { onStatus });

    expect(onStatus).toHaveBeenCalledWith("Fetching player stats · Comparing players");
  });

  it("does not throw when onStatus is not provided", async () => {
    mockExecuteTool.mockResolvedValueOnce({});
    mockCreate
      .mockReturnValueOnce(
        fakeStream([toolCallChunk(0, "c1", "get_teams", '{"league":"nba"}')])
      )
      .mockReturnValueOnce(fakeStream([contentChunk("Here are the teams.")]));

    await expect(runAgentLoop([], null, () => {})).resolves.toBe("Here are the teams.");
  });

  it("prepends conversationSummary as a system message before history", async () => {
    mockCreate.mockReturnValueOnce(fakeStream([contentChunk("Answer.")]));

    await runAgentLoop(
      [{ role: "user", content: "Latest question" }],
      null,
      () => {},
      { conversationSummary: "User has been asking about LeBron James." }
    );

    const messages = mockCreate.mock.calls[0][0].messages;
    // messages: [system prompt, summary system msg, user history]
    const summaryMsg = messages.find(
      (m) => m.role === "system" && m.content.includes("Summary of earlier conversation")
    );
    expect(summaryMsg).toBeDefined();
    expect(summaryMsg.content).toContain("User has been asking about LeBron James.");
    // Summary message should come before history
    const summaryIdx = messages.indexOf(summaryMsg);
    const historyIdx = messages.findIndex((m) => m.content === "Latest question");
    expect(summaryIdx).toBeLessThan(historyIdx);
  });

  it("does not add summary system message when conversationSummary is null", async () => {
    mockCreate.mockReturnValueOnce(fakeStream([contentChunk("Answer.")]));

    await runAgentLoop([], null, () => {}, { conversationSummary: null });

    const messages = mockCreate.mock.calls[0][0].messages;
    const summaryMsg = messages.find(
      (m) => m.role === "system" && m.content.includes("Summary of earlier conversation")
    );
    expect(summaryMsg).toBeUndefined();
  });

  it("builds up tool call name and arguments from incremental delta chunks", async () => {
    mockExecuteTool.mockResolvedValueOnce([]);
    mockCreate
      .mockReturnValueOnce(
        fakeStream([
          // Simulate OpenAI streaming: index + id in first chunk, name in next, args split across two
          { choices: [{ delta: { tool_calls: [{ index: 0, id: "call-x", function: { name: "", arguments: "" } }] } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "search", arguments: "" } }] } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "", arguments: '{"term"' } }] } }] },
          { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "", arguments: ':"LeBron"}' } }] } }] },
        ])
      )
      .mockReturnValueOnce(fakeStream([contentChunk("Done.")]));

    await runAgentLoop([], null, () => {});

    expect(mockExecuteTool).toHaveBeenCalledWith("search", { term: "LeBron" });
  });
});

// summarizeOlderMessages uses non-streaming completions: { choices: [{ message: { content } }] }
function fakeSummaryResponse(text) {
  return { choices: [{ message: { content: text } }] };
}

describe("chatAgentService — summarizeOlderMessages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  it("calls OpenAI to produce a fresh summary when no existing summary", async () => {
    mockCreate.mockResolvedValueOnce(fakeSummaryResponse("User asked about LeBron and standings."));

    const messages = [
      { role: "user", content: "How is LeBron doing?" },
      { role: "assistant", content: "LeBron is averaging 28 points." },
    ];

    const result = await summarizeOlderMessages(messages, null);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    // The call should use gpt-4o-mini
    expect(mockCreate.mock.calls[0][0].model).toBe("gpt-4o-mini");
    expect(result).toBe("User asked about LeBron and standings.");
  });

  it("formats messages as 'User:' / 'Assistant:' lines in the prompt", async () => {
    mockCreate.mockResolvedValueOnce(fakeSummaryResponse("Summary."));

    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];

    await summarizeOlderMessages(messages, null);

    const userPrompt = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain("User: Hello");
    expect(userPrompt).toContain("Assistant: Hi there");
  });

  it("incorporates existing summary into prompt when provided", async () => {
    mockCreate.mockResolvedValueOnce(fakeSummaryResponse("Updated summary."));

    const messages = [{ role: "user", content: "New question" }];
    const existingSummary = "User was discussing LeBron James earlier.";

    await summarizeOlderMessages(messages, existingSummary);

    const userPrompt = mockCreate.mock.calls[0][0].messages[1].content;
    expect(userPrompt).toContain("User was discussing LeBron James earlier.");
    expect(userPrompt).toContain("New question");
  });

  it("returns the trimmed content from the model response", async () => {
    mockCreate.mockResolvedValueOnce(fakeSummaryResponse("  Trimmed summary.  "));

    const result = await summarizeOlderMessages(
      [{ role: "user", content: "Hi" }],
      null
    );

    expect(result).toBe("Trimmed summary.");
  });
});

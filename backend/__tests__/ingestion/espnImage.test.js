import { describe, it, expect } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { espnImage } = await import(
  resolve(__dirname, "../../src/ingestion/espnImage.js")
);

const ESPN_URL = "https://a.espncdn.com/i/teamlogos/nba/500/lal.png";
const COMBINER_BASE = "https://a.espncdn.com/combiner/i";

describe("espnImage", () => {
  it("rewrites an ESPN CDN URL to the combiner URL with width and height", () => {
    const result = espnImage(ESPN_URL, 64, 64);

    expect(result).toBe(
      `${COMBINER_BASE}?img=/i/teamlogos/nba/500/lal.png&w=64&h=64`
    );
  });

  it("includes the correct width and height values", () => {
    const result = espnImage(ESPN_URL, 128, 96);

    expect(result).toContain("w=128");
    expect(result).toContain("h=96");
  });

  it("strips the protocol and host before building the combiner URL", () => {
    const result = espnImage(ESPN_URL, 64, 64);

    expect(result).not.toContain("https://a.espncdn.com/i/");
    expect(result).toContain("img=/i/teamlogos");
  });

  it("returns the URL unchanged when it is not an ESPN CDN URL", () => {
    const nonEspn = "https://example.com/logo.png";
    expect(espnImage(nonEspn, 64, 64)).toBe(nonEspn);
  });

  it("returns null as-is", () => {
    expect(espnImage(null, 64, 64)).toBeNull();
  });

  it("returns undefined as-is", () => {
    expect(espnImage(undefined, 64, 64)).toBeUndefined();
  });

  it("returns empty string as-is", () => {
    expect(espnImage("", 64, 64)).toBe("");
  });

  it("handles HTTP ESPN URLs as well as HTTPS", () => {
    const httpUrl = "http://a.espncdn.com/i/teamlogos/nba/500/lal.png";
    const result = espnImage(httpUrl, 64, 64);

    expect(result).toBe(`${COMBINER_BASE}?img=/i/teamlogos/nba/500/lal.png&w=64&h=64`);
  });
});

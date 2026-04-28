import axios from "axios";
import { withRetry } from "../espn/espnAPIClient.js";
import { getSportPath } from "../../utils/sportPath.js";

const ATHLETE_ID_RE = /\/athletes\/(\d+)/;

function parseAthleteId(ref) {
  if (!ref) return null;
  const m = ref.match(ATHLETE_ID_RE);
  return m ? Number(m[1]) : null;
}

export async function fetchAwardIndex(league, espnYear) {
  const sport = getSportPath(league);
  const url = `https://sports.core.api.espn.com/v2/sports/${sport}/leagues/${league}/seasons/${espnYear}/awards`;
  try {
    const resp = await axios.get(url, { timeout: 10000 });
    const items = Array.isArray(resp.data?.items) ? resp.data.items : [];
    return items.map((it) => it.$ref).filter(Boolean);
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function fetchAward(refUrl) {
  const resp = await withRetry(() => axios.get(refUrl, { timeout: 10000 }), {
    label: `award:${refUrl}`,
  });
  const data = resp.data ?? {};
  const winners = Array.isArray(data.winners) ? data.winners : [];
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    winners: winners
      .map((w) => ({ athleteId: parseAthleteId(w?.athlete?.$ref) }))
      .filter((w) => w.athleteId !== null),
  };
}

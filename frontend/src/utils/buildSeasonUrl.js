export default function buildSeasonUrl(path, season) {
  return season ? `${path}?season=${season}` : path;
}

import LeaguePage from '../LeaguePage';

export default function Nba() {
  return (
    <LeaguePage
      league="NBA"
      links={[
        { to: "/nba/players", label: "Players" },
        { to: "/nba/teams", label: "Teams" }
      ]}
    />
  );
}
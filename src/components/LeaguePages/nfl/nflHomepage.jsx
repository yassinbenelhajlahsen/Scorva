import LeaguePage from '../LeaguePage';

export default function Nfl() {
  return (
    <LeaguePage
      league="NFL"
      links={[
        { to: "/nfl/players", label: "Players" },
        { to: "/nfl/teams", label: "Teams" }
      ]}
    />
  );
}
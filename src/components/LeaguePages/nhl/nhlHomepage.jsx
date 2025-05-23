import LeaguePage from '../LeaguePage';

export default function Nhl() {
  return (
    <LeaguePage
      league="NHL"
      links={[
        { to: "/nhl/players", label: "Players" },
        { to: "/nhl/teams", label: "Teams" }
      ]}
    />
  );
}
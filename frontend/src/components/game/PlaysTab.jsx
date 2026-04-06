import PlayByPlay from "../ui/PlayByPlay.jsx";

export default function PlaysTab({ league, gameId, isFinal, inProgress }) {
  if (isFinal || inProgress) {
    return <PlayByPlay league={league} gameId={gameId} isLive={inProgress} />;
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-tertiary text-sm">
      No data available yet — check back when the game starts.
    </div>
  );
}

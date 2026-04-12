import SeriesCard from "./SeriesCard.jsx";

function ConferencePlayIn({ heading, series, league }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3 text-center">
        {heading}
      </h4>
      <div className="flex flex-col gap-2">
        {series.length === 0 ? (
          <div className="text-xs text-text-tertiary text-center py-4">
            No play-in games
          </div>
        ) : (
          series.map((s, i) => <SeriesCard key={i} series={s} league={league} />)
        )}
      </div>
    </div>
  );
}

export default function PlayInSection({ playIn, league }) {
  if (!playIn) return null;
  const east = playIn.eastern || [];
  const west = playIn.western || [];
  if (east.length === 0 && west.length === 0) return null;

  return (
    <div className="mb-10">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-text-secondary mb-5 text-center">
        Play-In Tournament
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[720px] mx-auto">
        <ConferencePlayIn heading="Eastern" series={east} league={league} />
        <ConferencePlayIn heading="Western" series={west} league={league} />
      </div>
    </div>
  );
}

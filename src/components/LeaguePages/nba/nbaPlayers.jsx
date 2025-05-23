import logo from '../../../assets/NBAlogo.png';
import LeagueSubPage from '../LeagueSubPage';

export default function NbaPlayers() {
  return (
    <LeagueSubPage league="NBA" logo={logo} section="Players" />
  );
}
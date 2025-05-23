import logo from '../../../assets/NBAlogo.png';
import LeagueSubPage from '../LeagueSubPage';

export default function NbaTeams() {
    return (
        <LeagueSubPage league="NBA" logo={logo} section="Teams" />
    );
}
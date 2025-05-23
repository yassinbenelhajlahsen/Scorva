import logo from '../../../assets/NFLlogo.png';
import LeagueSubPage from '../LeagueSubPage';

export default function NflTeams() {  
    return (
        <LeagueSubPage league="NFL" logo={logo} section="Teams" />
    );
}
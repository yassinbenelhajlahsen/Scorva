import logo from '../../../assets/NHLlogo.png';
import LeagueSubPage from '../LeagueSubPage';

export default function NhlPlayers() {
    return (
        <LeagueSubPage league="NHL" logo={logo} section="Players" />
    );
}

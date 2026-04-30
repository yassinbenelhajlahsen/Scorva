import InjuryReportRow from "./InjuryReportRow.jsx";
import MoveReportRow from "./MoveReportRow.jsx";
import BirthdayReportRow from "./BirthdayReportRow.jsx";
import StreakReportRow from "./StreakReportRow.jsx";

export default function ReportRow({ report }) {
  switch (report.type) {
    case "injury":   return <InjuryReportRow report={report} />;
    case "move":     return <MoveReportRow report={report} />;
    case "birthday": return <BirthdayReportRow report={report} />;
    case "streak":   return <StreakReportRow report={report} />;
    default:         return null;
  }
}

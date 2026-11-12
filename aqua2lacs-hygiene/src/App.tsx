import { useEffect } from "react";
import { useSession } from "./data/store";
import { AdminDay, AdminHistory, AdminLogin, AdminSheet } from "./screens/admin";
import { AdminSettings, AdminTaskEdit, AdminTasks, AdminTeam, AdminZones } from "./screens/adminRef";
import { Home, PinScreen, Recap, Thanks, Today } from "./screens/agent";
import { go, useRoute } from "./ui/router";

function Redirect({ to }: { to: string }) {
  useEffect(() => go(to, true), [to]);
  return null;
}

export function App() {
  const [a, b, c] = useRoute();
  const session = useSession();

  if (a === "admin") {
    if (!session.admin) return <AdminLogin />;
    switch (b) {
      case "historique":
        return <AdminHistory />;
      case "fiche":
        return <AdminSheet id={c ?? ""} />;
      case "taches":
        return <AdminTasks />;
      case "tache":
        return <AdminTaskEdit key={c} id={c ?? ""} />;
      case "zones":
        return <AdminZones />;
      case "equipe":
        return <AdminTeam />;
      case "reglages":
        return <AdminSettings />;
      default:
        return <AdminDay />;
    }
  }

  switch (a) {
    case "pin":
      return <PinScreen key={b} agentId={b ?? ""} />;
    case "jour":
      return <Today />;
    case "recap":
      return <Recap />;
    case "merci":
      return <Thanks />;
    default:
      // Un agent déjà identifié retrouve directement sa checklist.
      return session.agentId ? <Redirect to="/jour" /> : <Home />;
  }
}

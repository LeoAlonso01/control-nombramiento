import { ReportesClient } from "./reportes-client";

import { connection } from "next/server";

export default async function ReportesPage() {
  await connection();
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City" }).format(new Date());
  return <ReportesClient initialFilters={{ desde: `${today.slice(0, 7)}-01`, hasta: today }} />;
}

import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter, billingRouter } from "./routers/account";
import { aiRouter, settingsRouter } from "./routers/ai";
import { documentsRouter } from "./routers/documents";
import {
  vehiclesRouter,
  driversRouter,
  tripsRouter,
  maintenanceRouter,
  dashboardRouter,
} from "./routers/fleet";
import { expensesRouter, revenuesRouter } from "./routers/finance";
import { driverAppRouter } from "./routers/driverApp";
import { geoRouter } from "./routers/geo";

// Composição do roteador tRPC. Cada domínio vive em server/routers/*.
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  billing: billingRouter,
  ai: aiRouter,
  settings: settingsRouter,
  documents: documentsRouter,
  vehicles: vehiclesRouter,
  drivers: driversRouter,
  trips: tripsRouter,
  maintenance: maintenanceRouter,
  dashboard: dashboardRouter,
  expenses: expensesRouter,
  revenues: revenuesRouter,
  driverApp: driverAppRouter,
  geo: geoRouter,
});

export type AppRouter = typeof appRouter;

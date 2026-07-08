import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { configRouter, authRouter, billingRouter } from "./routers/account";
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

// Composição do roteador tRPC. Cada domínio vive em server/routers/*.
export const appRouter = router({
  system: systemRouter,
  config: configRouter,
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
});

export type AppRouter = typeof appRouter;

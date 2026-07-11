import { Toaster } from "@/components/ui/sonner";
import { ErrorDialogHost } from "@/lib/errorDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import DriverApp from "./pages/DriverApp";
import Dashboard from "./pages/Dashboard";
import Vehicles from "./pages/Vehicles";
import Drivers from "./pages/Drivers";
import Trips from "./pages/Trips";
import Notifications from "./pages/Notifications";
import Maintenance from "./pages/Maintenance";
import VehicleDetail from "./pages/VehicleDetail";
import DriverDetail from "./pages/DriverDetail";
import DocumentManagement from "./pages/DocumentManagement";
import Reports from "./pages/Reports";
import Financial from "./pages/Financial";
import TripTracking from "./pages/TripTracking";
import Settings from "./pages/Settings";
// Lazy: o Assistente puxa o Streamdown (shiki) — carrega só ao abrir /assistant,
// mantendo o bundle principal enxuto.
const Assistant = lazy(() => import("./pages/Assistant"));

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/vehicles"} component={Vehicles} />
      <Route path={"/vehicles/:id"} component={VehicleDetail} />
      <Route path={"/drivers"} component={Drivers} />
      <Route path={"/drivers/:id"} component={DriverDetail} />
      <Route path={"/trips"} component={Trips} />
      <Route path={"/trips/:id/tracking"} component={TripTracking} />
      <Route path={"/notifications"} component={Notifications} />
      <Route path={"/maintenance"} component={Maintenance} />
      <Route path={"/documents"} component={DocumentManagement} />
      <Route path={"/reports"} component={Reports} />
      <Route path={"/financial"} component={Financial} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/assistant"}>
        <Suspense
          fallback={
            <div className="p-6 text-muted-foreground">Carregando…</div>
          }
        >
          <Assistant />
        </Suspense>
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <ErrorDialogHost />
          <Switch>
            {/* Área do motorista: login e chrome próprios, fora do dashboard. */}
            <Route path="/motorista" component={DriverApp} />
            <Route>
              <DashboardLayout>
                <Router />
              </DashboardLayout>
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

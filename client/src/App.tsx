import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";

import PlayersPage from "@/pages/players";
import GeneratePage from "@/pages/generate";
import ResultsPage from "@/pages/results";
import SettingsPage from "@/pages/settings";
import TournamentPage from "@/pages/tournament";
import StatsPage from "@/pages/stats";
import RotationPage from "@/pages/rotation";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/players" />} />
      <Route path="/players" component={PlayersPage} />
      <Route path="/generate" component={GeneratePage} />
      <Route path="/results" component={ResultsPage} />
      <Route path="/stats" component={StatsPage} />
      <Route path="/rotation" component={RotationPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/tournament" component={TournamentPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <div classname="app-container" />
          <Toaster />
          <Router />
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

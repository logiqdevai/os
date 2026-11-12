import AppRoutes from "./routes";
import { BrowserRouter } from "react-router-dom";
import QueryProvider from "./components/providers/query-provider.tsx";
import { Toaster } from "./components/ui/toaster.tsx";
import { RadixPointerEventsGuard } from "./components/providers/radix-pointer-events-guard.tsx";
import { TooltipProvider } from "./components/ui/tooltip.tsx";
import { AppearanceSync } from "./components/providers/appearance-sync.tsx";

function App() {
  return (
    <BrowserRouter>
      <QueryProvider>
        {/* One provider for every shell (agency app, customer portal, public pages). */}
        <TooltipProvider delayDuration={300}>
          <AppearanceSync />
          <AppRoutes />
          <Toaster />
          <RadixPointerEventsGuard />
        </TooltipProvider>
      </QueryProvider>
    </BrowserRouter>
  );
}

export default App;

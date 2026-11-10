import AppRoutes from "./routes";
import { BrowserRouter } from "react-router-dom";
import QueryProvider from "./components/providers/query-provider.tsx";
import { Toaster } from "./components/ui/toaster.tsx";
import { RadixPointerEventsGuard } from "./components/providers/radix-pointer-events-guard.tsx";

function App() {
  return (
    <BrowserRouter>
      <QueryProvider>
        <AppRoutes />
        <Toaster />
        <RadixPointerEventsGuard />
      </QueryProvider>
    </BrowserRouter>
  );
}

export default App;

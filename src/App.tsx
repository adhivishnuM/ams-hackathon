import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import HomePage from "./pages/HomePage";
import MarketPage from "./pages/MarketPage";
import LibraryPage from "./pages/LibraryPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

import CallAgentPage from "./pages/CallAgentPage";
import AnalyzePage from "./pages/AnalyzePage";
import LibraryDetailPage from "./pages/LibraryDetailPage";
import LoginPage from "./pages/LoginPage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { get, set, del } from "idb-keyval";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

// Custom async persister using idb-keyval for better stability and storage limits than localStorage
const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => {
      try {
        const value = await get(key);
        // If the value is somehow the string "[object Promise]", it's corrupted
        if (value === "[object Promise]") {
          await del(key);
          return null;
        }
        return value;
      } catch {
        return null;
      }
    },
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
});

import { LogOut, User as UserIcon } from "lucide-react";

// Inner component so it can consume AuthContext
function ProtectedApp() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="/call-agent" element={<CallAgentPage />} />
            <Route path="/analyze" element={<AnalyzePage />} />
            <Route path="/library/:id" element={<LibraryDetailPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </AppProvider>
    </BrowserRouter>
  );
}

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{ persister }}
  >
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <ProtectedApp />
      </AuthProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;

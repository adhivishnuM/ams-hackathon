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

function UserProfileChip() {
  const { user, logout } = useAuth();
  const location = useLocation();

  if (!user || location.pathname !== "/") return null;

  const userDisplayName = user.displayName || user.phoneNumber || 'Agro Farmer';
  const userInitial = userDisplayName.charAt(0).toUpperCase();
  const loginMethod = user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Phone Login';

  // Function to get a consistent color based on user's name
  const getAvatarColor = (name: string) => {
    const colors = [
      'from-rose-400 to-rose-600',
      'from-blue-400 to-blue-600',
      'from-emerald-400 to-emerald-600',
      'from-violet-400 to-violet-600',
      'from-amber-400 to-amber-600',
      'from-indigo-400 to-indigo-600',
      'from-cyan-400 to-cyan-600',
      'from-fuchsia-400 to-fuchsia-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const avatarGradient = getAvatarColor(userDisplayName);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex items-center">
      <div className="
          flex items-center gap-3
          bg-white/80 backdrop-blur-xl
          border border-slate-200/60
          p-1.5 pl-4 rounded-[2rem]
          shadow-[0_8px_30px_rgb(0,0,0,0.06)]
          animate-fade-in
        ">
        <div className="flex flex-col items-end pr-1 justify-center translate-y-[-1px]">
          <span className="text-[14px] font-semibold text-slate-800 leading-tight tracking-tight">
            {userDisplayName}
          </span>
          <span className="text-[11px] font-medium text-slate-400 leading-tight">
            {loginMethod}
          </span>
        </div>

        <div className="relative group">
          <button
            onClick={logout}
            className={`
                w-11 h-11 rounded-full border-2 border-white shadow-sm
                overflow-hidden flex items-center justify-center
                bg-gradient-to-br ${avatarGradient} text-white
                transition-all duration-300 hover:scale-105 hover:shadow-md
                relative
              `}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={userDisplayName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`${user.photoURL ? 'hidden' : ''} font-bold text-lg`}>
              {userInitial}
            </div>

            {/* Hover Sign Out overlay */}
            <div className="absolute inset-0 bg-red-500/90 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 flex-col">
              <LogOut size={16} strokeWidth={2.5} className="mb-0.5" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// Inner component so it can consume AuthContext
function ProtectedApp() {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-green" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>

        {/* Enhanced User Profile Chip */}
        <UserProfileChip />
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

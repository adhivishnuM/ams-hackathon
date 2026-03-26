import { ReactNode, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, Camera, BookOpen, Settings, ChevronLeft, ChevronRight, PhoneCall } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { BottomNavigation, type NavTab } from '@/components/BottomNavigation';
import { OfflineBanner } from '@/components/OfflineBanner';
import { getTranslation } from '@/lib/translations';

interface LayoutProps {
    children: ReactNode;
}

const NAV_ITEMS: { id: NavTab; icon: typeof Home; labelKey: string }[] = [
    { id: 'home',      icon: Home,        labelKey: 'home' },
    { id: 'market',    icon: ShoppingBag, labelKey: 'market' },
    { id: 'analyze',   icon: Camera,      labelKey: 'analyze' },
    { id: 'assistant', icon: PhoneCall,   labelKey: 'assistant' },
    { id: 'library',   icon: BookOpen,    labelKey: 'library' },
    { id: 'settings',  icon: Settings,    labelKey: 'settings' },
];

export function Layout({ children }: LayoutProps) {
    const {
        isOnline,
        isChatMode,
        language,
    } = useApp();

    const [collapsed, setCollapsed] = useState(() =>
        localStorage.getItem('agro_sidebar_collapsed') === 'true'
    );

    const [mobileView, setMobileView] = useState(() =>
        localStorage.getItem('agro_mobile_view') === 'true'
    );

    useEffect(() => {
        const handler = () => setMobileView(localStorage.getItem('agro_mobile_view') === 'true');
        window.addEventListener('mobile-view-change', handler);
        return () => window.removeEventListener('mobile-view-change', handler);
    }, []);

    useEffect(() => {
        localStorage.setItem('agro_sidebar_collapsed', String(collapsed));
    }, [collapsed]);

    const location = useLocation();
    const navigate = useNavigate();
    const t = getTranslation('nav', language);
    const tc = getTranslation('common', language);

    const getActiveTab = (): NavTab => {
        switch (location.pathname) {
            case '/market':      return 'market';
            case '/library':     return 'library';
            case '/settings':    return 'settings';
            case '/analyze':     return 'analyze';
            case '/call-agent':  return 'assistant';
            default:             return 'home';
        }
    };

    const activeTab = getActiveTab();

    const handleTabChange = (tab: NavTab) => {
        const routes: Record<NavTab, string> = {
            home: '/', market: '/market', library: '/library',
            settings: '/settings', analyze: '/analyze', assistant: '/call-agent',
        };
        navigate(routes[tab]);
    };

    const isCallAgent = location.pathname === '/call-agent';
    // Sidebar always visible — call agent gets it too since it's now a nav item
    const showSidebar = true;
    // Bottom nav hides in chat mode and call agent
    const showBottomNav = !isCallAgent && !isChatMode;

    const sidebarLabels: Record<string, string> = {
        home: t.home, market: t.market, analyze: (t as any).analyze || 'Scan Crop',
        assistant: (t as any).assistant || 'Voice Agent', library: t.library, settings: t.settings
    };

    const sidebarW = collapsed ? 'w-[68px]' : 'w-64';
    const contentPl = collapsed ? 'lg:pl-[68px]' : 'lg:pl-64';

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            {!isOnline && <OfflineBanner language={language} />}

            {/* ── Desktop sidebar ── */}
            {showSidebar && (
                <aside
                    className={cn(
                        'hidden lg:flex flex-col fixed left-0 top-0 h-full z-40 border-r border-border/40 transition-all duration-500 shadow-[20px_0_40px_rgba(0,0,0,0.02)]',
                        sidebarW
                    )}
                    style={{
                        background: 'rgba(255, 255, 255, 0.85)',
                        backdropFilter: 'blur(40px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                    }}
                >
                    {/* Brand */}
                    <div className={cn(
                        'flex items-center transition-all duration-500 border-b border-border/20',
                        collapsed ? 'px-3 py-6 justify-center' : 'px-6 py-6 gap-4'
                    )}>
                        <div className="relative group/logo">
                            <div className="absolute -inset-2 bg-primary/20 rounded-full blur-lg opacity-0 group-hover/logo:opacity-100 transition-opacity" />
                            <img
                                src="/logo.svg"
                                alt="AgroTalk"
                                className={cn(
                                    'shrink-0 rounded-2xl object-contain transition-all duration-500 relative z-10',
                                    collapsed ? 'w-10 h-10' : 'w-10 h-10'
                                )}
                            />
                        </div>
                        {!collapsed && (
                            <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-500">
                                <p className="text-[17px] font-black text-foreground leading-none tracking-tight">AgroTalk</p>
                                <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1 opacity-80">{(tc as any).professionalAi}</p>
                            </div>
                        )}
                    </div>

                    {/* Nav items */}
                    <nav className={cn('flex-1 py-8 space-y-1.5 transition-all duration-300', collapsed ? 'px-2' : 'px-4')}>
                        {!collapsed && (
                            <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] px-3 pb-4">{(tc as any).menuSystem}</p>
                        )}
                        {NAV_ITEMS.map(({ id, icon: Icon, labelKey }) => {
                            const isActive = activeTab === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => handleTabChange(id)}
                                    title={collapsed ? sidebarLabels[labelKey] : undefined}
                                    className={cn(
                                        'w-full flex items-center rounded-2xl text-[14px] font-bold transition-all duration-300 group relative overflow-hidden',
                                        collapsed ? 'justify-center p-3.5' : 'gap-4 px-4 py-3.5',
                                        isActive
                                            ? 'bg-primary text-white shadow-[0_10px_20px_rgba(118,185,0,0.2)]'
                                            : 'text-muted-foreground/70 hover:bg-primary/5 hover:text-primary'
                                    )}
                                >
                                    {isActive && !collapsed && (
                                        <div className="absolute left-0 top-0 w-1 h-full bg-white/40" />
                                    )}
                                    <Icon
                                        size={20}
                                        strokeWidth={isActive ? 2.5 : 2}
                                        className={cn(
                                            'shrink-0 transition-transform duration-500',
                                            !isActive && 'group-hover:scale-110 group-hover:rotate-3'
                                        )}
                                    />
                                    {!collapsed && (
                                        <>
                                            <span className="flex-1 text-left tracking-tight">{sidebarLabels[labelKey] || labelKey}</span>
                                            {isActive && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white] animate-pulse" />
                                            )}
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Bottom: collapse */}
                    <div className={cn('border-t border-border/20 py-6 flex flex-col gap-3', collapsed ? 'px-2' : 'px-4')}>
                        {/* Collapse toggle */}
                        <button
                            onClick={() => setCollapsed(c => !c)}
                            className={cn(
                                'w-full flex items-center rounded-2xl text-[11px] font-bold text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground transition-all duration-500 group',
                                collapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'
                            )}
                            title={collapsed ? (tc as any).expandView : (tc as any).collapseView}
                        >
                            <div className="w-5 h-5 flex items-center justify-center rounded-lg bg-muted/40 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                            </div>
                            {!collapsed && <span className="uppercase tracking-[0.1em]">{(tc as any).collapseView}</span>}
                        </button>
                    </div>
                </aside>
            )}

            {/* ── Main content ── */}
            <main className={cn(
                'flex-1 flex flex-col min-h-screen transition-all duration-500 relative',
                showSidebar && !mobileView ? contentPl : '',
                !isOnline ? 'pt-14' : 'pt-0',
                isChatMode && location.pathname === '/' ? 'h-screen' : ''
            )}>
                {/* Global Background Particles/Effects could go here */}
                
                {mobileView ? (
                    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-green-50 flex items-center justify-center py-6 px-4">
                        <div
                            className="relative bg-background rounded-[48px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.18),0_0_0_1px_rgba(0,0,0,0.05)] border-[7px] border-slate-900 mobile-frame"
                            style={{
                                width: 390,
                                minWidth: 0,
                                maxWidth: '100vw',
                                height: 'min(844px, 90vh)',
                                display: 'flex',
                                flexDirection: 'column',
                                position: 'relative',
                            }}
                        >
                            {/* Phone dynamic island */}
                            <div className="flex-shrink-0 flex items-start justify-center pt-1 bg-background z-50">
                                <div className="w-28 h-7 bg-slate-900 rounded-b-[20px]" />
                            </div>
                            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-20">
                                {children}
                            </div>
                            {/* Bottom nav inside frame */}
                            {showBottomNav && (
                                <div className="flex-shrink-0 border-t border-border/30">
                                    <BottomNavigation
                                        activeTab={activeTab}
                                        onTabChange={handleTabChange}
                                        language={language}
                                    />
                                </div>
                            )}
                            {/* Home indicator */}
                            <div className="flex-shrink-0 flex justify-center pb-2 pt-1 bg-background">
                                <div className="w-32 h-1 bg-slate-800/40 rounded-full" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col w-full max-w-[1600px] mx-auto">
                        {children}
                    </div>
                )}
            </main>

            {/* ── Mobile bottom nav (only in normal/desktop view, not phone frame) ── */}
            {showBottomNav && !mobileView && (
                <div className="lg:hidden">
                    <BottomNavigation
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        language={language}
                    />
                </div>
            )}

        </div>
    );
}

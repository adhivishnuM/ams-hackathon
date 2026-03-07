import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { BottomNavigation, type NavTab } from '@/components/BottomNavigation';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ImageAnalysis } from '@/components/ImageAnalysis';
import { useLibrary } from '@/hooks/useLibrary';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const { isOnline, isChatMode, language, isImageOpen, setIsImageOpen } = useApp();
    const location = useLocation();
    const navigate = useNavigate();
    const { refresh: refreshLibrary } = useLibrary();

    // Map route to NavTab
    const getActiveTab = (): NavTab => {
        switch (location.pathname) {
            case '/market':
                return 'market';
            case '/library':
                return 'library';
            case '/settings':
                return 'settings';
            default:
                return 'home';
        }
    };

    const handleTabChange = (tab: NavTab) => {
        if (tab === 'analyze') {
            navigate('/bird-detector');
        } else {
            const routes: Record<NavTab, string> = {
                home: '/',
                market: '/market',
                library: '/library',
                settings: '/settings',
                analyze: '/',
                assistant: '/',
            };
            navigate(routes[tab]);
        }
    };

    const handleShareToChat = (analysis: any) => {
        setIsImageOpen(false);
        navigate('/');
        // The HomePage will handle the shared analysis via context or URL state
    };

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            {!isOnline && <OfflineBanner language={language} />}

            <main className={cn(
                'flex-1 flex flex-col',
                !isOnline ? 'pt-14' : '',
                isChatMode && location.pathname === '/' ? 'h-screen' : ''
            )}>
                {children}
            </main>

            {(!isChatMode && location.pathname !== '/call-agent') && (
                <BottomNavigation
                    activeTab={getActiveTab()}
                    onTabChange={handleTabChange}
                    language={language}
                />
            )}

            <ImageAnalysis
                isOpen={isImageOpen}
                onClose={() => {
                    setIsImageOpen(false);
                    refreshLibrary();
                }}
                language={language}
                onShareChat={handleShareToChat}
            />
        </div>
    );
}

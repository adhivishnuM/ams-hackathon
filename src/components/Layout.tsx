import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { BottomNavigation, type NavTab } from '@/components/BottomNavigation';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ImageAnalysis } from '@/components/ImageAnalysis';
import { useLibrary } from '@/hooks/useLibrary';
import { getTranslation } from '@/lib/translations';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const {
        isOnline,
        isChatMode,
        language,
        isImageOpen,
        setIsImageOpen,
        setIsChatMode,
        setChatMessages,
        setConversationHistory
    } = useApp();
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
            setIsImageOpen(true);
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

    const handleShareToChat = async (analysis: any) => {
        setIsImageOpen(false);
        setIsChatMode(true);

        // Dynamically import to prevent circular dependencies if any
        const { getTranslation } = await import('@/lib/translations');
        const tLib = getTranslation('library', language);

        const cropName = (language === 'hi' || language === 'ta' || language === 'te' || language === 'mr')
            ? (analysis.cropTypeHi || analysis.crop_identified)
            : (analysis.cropType || analysis.crop_identified);

        const diseaseName = (language === 'hi' || language === 'ta' || language === 'te' || language === 'mr')
            ? (analysis.diseaseNameHi || analysis.disease_name_hindi)
            : (analysis.diseaseName || analysis.disease_name);

        const symptoms = (language === 'hi' || language === 'ta' || language === 'te' || language === 'mr')
            ? (analysis.symptomsHi || analysis.symptoms_hindi)
            : (analysis.symptoms || analysis.symptoms);

        const treatment = (language === 'hi' || language === 'ta' || language === 'te' || language === 'mr')
            ? (analysis.treatmentHi || analysis.treatment_steps_hindi)
            : (analysis.treatment || analysis.treatment_steps);

        const contextText = `${tLib.shareSubject}: ${cropName}\n${tLib.shareCondition}: ${diseaseName}\n${tLib.shareSymptoms}: ${symptoms?.join(", ")}\n${tLib.shareTreatment}: ${treatment?.join(", ")}`;

        setChatMessages(prev => [
            ...prev,
            {
                id: `context_${Date.now()}`,
                role: 'assistant',
                content: `**${tLib.shareTitle}**\n\n${contextText}`,
                timestamp: new Date(),
                condition: analysis.severity
            }
        ]);

        setConversationHistory(prev => [
            ...prev,
            { role: 'assistant' as const, content: `CONTEXT: User shared a ${analysis.cropType || analysis.crop_identified} analysis showing ${analysis.diseaseName || analysis.disease_name}. Severity: ${analysis.severity}. Details: ${analysis.description || analysis.summary}` }
        ].slice(-10));

        navigate('/');
    };

    return (
        <div className="min-h-screen bg-background overflow-x-hidden">
            {!isOnline && <OfflineBanner language={language} />}

            <main className={cn(
                'flex-1 flex flex-col',
                !isOnline ? 'pt-14' : 'pt-0',
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

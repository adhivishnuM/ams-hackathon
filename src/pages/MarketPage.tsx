import { useApp } from '@/contexts/AppContext';
import { MarketPriceScreen } from '@/components/MarketPriceScreen';
import { useNavigate } from 'react-router-dom';
import { getTranslation } from '@/lib/translations';

export default function MarketPage() {
    const { language, isOnline, setIsChatMode, setChatMessages, setConversationHistory } = useApp();
    const navigate = useNavigate();
    const tMarket = getTranslation('market', language);

    const handleMarketShare = (record: any) => {
        setIsChatMode(true);

        const contextText = `${tMarket.commodity}: ${record.commodity}\n${tMarket.market}: ${record.market}\n${tMarket.variety}: ${record.variety || 'N/A'}\n${tMarket.modalPrice}: ₹${record.modal_price}\n${tMarket.priceRange}: ₹${record.min_price} - ₹${record.max_price}\n${tMarket.updated}: ${record.arrival_date}`;

        const introMsg = tMarket.shareIntro
            .replace('{commodity}', record.commodity)
            .replace('{market}', record.market);

        setChatMessages(prev => [
            ...prev,
            {
                id: `context_${Date.now()}`,
                role: 'assistant',
                content: `**${tMarket.shareTitle}**\n\n${contextText}`,
                timestamp: new Date()
            }
        ]);

        setConversationHistory(prev => [
            ...prev,
            { role: 'assistant' as const, content: `CONTEXT: User shared a market price report for ${record.commodity} at ${record.market}. Price is ${record.modal_price} per 100 kg. Details: ${contextText}` }
        ].slice(-10));

        navigate('/');
    };

    return (
        <div className="flex flex-col flex-1 pb-24">
            <MarketPriceScreen
                language={language}
                isOnline={isOnline}
                onShareChat={handleMarketShare}
            />
        </div>
    );
}

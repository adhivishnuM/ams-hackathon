import { useApp } from '@/contexts/AppContext';
import { LibraryScreen } from '@/components/LibraryScreen';
import { useNavigate } from 'react-router-dom';
import { getTranslation } from '@/lib/translations';

export default function LibraryPage() {
    const { language, weatherData, isWeatherLoading, setIsChatMode, setChatMessages, setConversationHistory } = useApp();
    const navigate = useNavigate();

    const handleShareToChat = (analysis: any) => {
        setIsChatMode(true);

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

        const introMsg = tLib.shareIntro.replace('{crop}', cropName);

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
        <div className="flex flex-col flex-1 pb-24">
            <LibraryScreen
                language={language}
                weatherData={weatherData}
                isWeatherLoading={isWeatherLoading}
                onShareChat={handleShareToChat}
            />
        </div>
    );
}

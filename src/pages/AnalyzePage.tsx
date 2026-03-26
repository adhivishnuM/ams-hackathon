import { useNavigate } from 'react-router-dom';
import { ImageAnalysis } from '@/components/ImageAnalysis';
import { useApp } from '@/contexts/AppContext';
import { useLibrary } from '@/hooks/useLibrary';
import { getTranslation } from '@/lib/translations';

export default function AnalyzePage() {
    const { language, setIsChatMode, setChatMessages, setConversationHistory } = useApp();
    const { refresh: refreshLibrary } = useLibrary();
    const navigate = useNavigate();

    const handleShareToChat = async (analysis: any) => {
        setIsChatMode(true);
        const tLib = getTranslation('library', language);
        const isLocal = ['hi', 'ta', 'te', 'mr'].includes(language);
        const cropName = isLocal ? (analysis.cropTypeHi || analysis.crop_identified) : (analysis.cropType || analysis.crop_identified);
        const diseaseName = isLocal ? (analysis.diseaseNameHi || analysis.disease_name_hindi) : (analysis.diseaseName || analysis.disease_name);
        const symptoms = isLocal ? (analysis.symptomsHi || analysis.symptoms_hindi) : analysis.symptoms;
        const treatment = isLocal ? (analysis.treatmentHi || analysis.treatment_steps_hindi) : analysis.treatment;
        const contextText = `${tLib.shareSubject}: ${cropName}\n${tLib.shareCondition}: ${diseaseName}\n${tLib.shareSymptoms}: ${symptoms?.join(", ")}\n${tLib.shareTreatment}: ${treatment?.join(", ")}`;
        setChatMessages(prev => [...prev, {
            id: `context_${Date.now()}`, role: 'assistant',
            content: `**${tLib.shareTitle}**\n\n${contextText}`,
            timestamp: new Date(), condition: analysis.severity
        }]);
        setConversationHistory(prev => [...prev, {
            role: 'assistant' as const,
            content: `CONTEXT: User shared a ${analysis.cropType || analysis.crop_identified} analysis showing ${analysis.diseaseName || analysis.disease_name}. Severity: ${analysis.severity}.`
        }].slice(-10));
        navigate('/');
    };

    return (
        <ImageAnalysis
            isOpen={true}
            onClose={() => { refreshLibrary(); navigate(-1); }}
            language={language}
            onShareChat={handleShareToChat}
            variant="inline"
        />
    );
}

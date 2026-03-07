import { useApp } from '@/contexts/AppContext';
import { SettingsScreen } from '@/components/SettingsScreen';

export default function SettingsPage() {
    const { language, setLanguage, voiceSpeed, setVoiceSpeed } = useApp();

    return (
        <div className="flex flex-col flex-1 pb-24">
            <SettingsScreen
                language={language}
                onLanguageChange={setLanguage}
                voiceSpeed={voiceSpeed}
                onVoiceSpeedChange={setVoiceSpeed}
            />
        </div>
    );
}

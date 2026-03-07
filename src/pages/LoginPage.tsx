import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Smartphone } from 'lucide-react';

export default function LoginPage() {
    const { signInWithGoogle, sendOtp, confirmOtp } = useAuth();
    const [step, setStep] = useState<'method' | 'phone' | 'otp'>('method');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneNumber) return toast.error("Please enter a phone number");

        setIsLoading(true);
        try {
            // Ensure phone number starts with + and country code
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
            await sendOtp(formattedPhone, 'recaptcha-container');
            setStep('otp');
            toast.success("OTP sent successfully");
        } catch (error: any) {
            toast.error(error.message || "Failed to send OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp) return toast.error("Please enter the OTP");

        setIsLoading(true);
        try {
            await confirmOtp(otp);
            toast.success("Logged in successfully");
        } catch (error: any) {
            toast.error(error.message || "Invalid OTP");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Background blobs */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-[#76b900]/8 blur-3xl opacity-50" />
                <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-[#76b900]/5 blur-3xl opacity-50" />
            </div>

            <div id="recaptcha-container"></div>

            <div className="relative w-full max-w-sm mx-4 animate-fade-in">
                <div className="bg-white rounded-[40px] p-8 flex flex-col items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-50">

                    {/* Logo Section */}
                    <div className="flex flex-col items-center gap-3 text-center pt-2">
                        <div className="w-24 h-24 rounded-3xl flex items-center justify-center bg-[#76b900]/5 border border-[#76b900]/10 shadow-[0_10px_30px_rgba(118,185,0,0.15)] overflow-hidden">
                            <img src="/logo.svg" alt="AgroTalk" className="w-full h-full object-cover scale-110" />
                        </div>
                        <div className="mt-2">
                            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none">
                                AGROTALK <span className="text-[#76b900]">ASSIST</span>
                            </h1>
                            <p className="text-sm font-medium text-slate-500 mt-2">
                                Your AI-powered farming companion
                            </p>
                        </div>
                    </div>

                    <div className="w-full h-[1px] bg-slate-100 mt-2" />

                    {/* Content Section */}
                    {step === 'method' && (
                        <div className="w-full flex flex-col gap-4 py-2">
                            <p className="text-sm font-medium text-slate-400 text-center mb-1">Choose a sign-in method</p>

                            <button
                                onClick={signInWithGoogle}
                                className="w-full h-14 flex items-center justify-center gap-4 bg-white border border-slate-100 rounded-full text-slate-700 font-bold text-[16px] transition-all hover:bg-slate-50 hover:border-slate-200 active:scale-[0.98] shadow-sm"
                            >
                                <svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                                </svg>
                                Continue with Google
                            </button>

                            <button
                                onClick={() => setStep('phone')}
                                className="w-full h-14 flex items-center justify-center gap-4 bg-[#76b900] text-white font-bold text-[16px] rounded-full transition-all hover:bg-[#68a400] active:scale-[0.98] shadow-[0_10px_20px_rgba(118,185,0,0.3)]"
                            >
                                <Smartphone size={22} className="stroke-[3px]" />
                                Continue with Phone
                            </button>
                        </div>
                    )}

                    {step === 'phone' && (
                        <form onSubmit={handleSendOtp} className="w-full flex flex-col gap-4 animate-scale-in">
                            <div className="text-center mb-2">
                                <p className="text-sm font-bold text-slate-700">Enter your phone number</p>
                                <p className="text-xs text-slate-400 mt-1">We'll send a code to verify it's you</p>
                            </div>

                            <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">+91</span>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    placeholder="Enter 10 digit number"
                                    className="w-full h-14 pl-16 pr-6 rounded-full bg-slate-50 border border-slate-100 text-[16px] font-bold text-slate-700 focus:outline-none focus:border-[#76b900]/30 focus:ring-4 focus:ring-[#76b900]/10 transition-all placeholder:text-slate-300 placeholder:font-medium"
                                    autoFocus
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-14 bg-[#76b900] text-white font-bold text-[16px] rounded-full shadow-[0_10px_20px_rgba(118,185,0,0.3)] hover:bg-[#68a400] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isLoading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Get OTP Code'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep('method')}
                                className="text-sm font-bold text-slate-400 hover:text-[#76b900] transition-colors py-2"
                            >
                                Change method
                            </button>
                        </form>
                    )}

                    {step === 'otp' && (
                        <form onSubmit={handleVerifyOtp} className="w-full flex flex-col gap-4 animate-scale-in">
                            <div className="text-center mb-2">
                                <p className="text-sm font-bold text-slate-700">Verify OTP</p>
                                <p className="text-xs text-slate-400 mt-1">Sent to +91 {phoneNumber}</p>
                            </div>

                            <input
                                type="text"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                className="w-full h-16 px-6 text-center text-3xl font-black tracking-[1em] rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 focus:outline-none focus:border-[#76b900]/30 focus:ring-4 focus:ring-[#76b900]/10 transition-all placeholder:text-slate-200 placeholder:tracking-normal placeholder:font-normal placeholder:text-xl"
                                autoFocus
                            />

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-14 bg-[#76b900] text-white font-bold text-[16px] rounded-full shadow-[0_10px_20px_rgba(118,185,0,0.3)] hover:bg-[#68a400] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isLoading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Verify & Sign In'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep('phone')}
                                className="text-sm font-bold text-slate-400 hover:text-[#76b900] transition-colors py-2"
                            >
                                Resend code
                            </button>
                        </form>
                    )}

                    <p className="text-[11px] font-medium text-slate-400 text-center leading-relaxed px-4 pb-2">
                        By signing in, you agree to our terms of service and privacy policy.
                    </p>
                </div>
            </div>
        </div>
    );
}

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    ConfirmationResult,
    RecaptchaVerifier,
    signInWithPhoneNumber,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
    user: User | null;
    isAuthLoading: boolean;
    signInWithGoogle: () => Promise<void>;
    sendOtp: (phoneNumber: string, recaptchaContainerId: string) => Promise<void>;
    confirmOtp: (otp: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setIsAuthLoading(false);
        });
        return unsubscribe;
    }, []);

    const signInWithGoogle = async () => {
        await signInWithPopup(auth, googleProvider);
    };

    const sendOtp = async (phoneNumber: string, recaptchaContainerId: string) => {
        try {
            const recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
                size: 'invisible',
            });
            const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
            setConfirmationResult(result);
        } catch (error) {
            console.error("Error sending OTP", error);
            throw error;
        }
    };

    const confirmOtp = async (otp: string) => {
        if (!confirmationResult) throw new Error("No confirmation result found");
        try {
            await confirmationResult.confirm(otp);
            setConfirmationResult(null);
        } catch (error) {
            console.error("Error confirming OTP", error);
            throw error;
        }
    };

    const logout = async () => {
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthLoading, signInWithGoogle, sendOtp, confirmOtp, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}

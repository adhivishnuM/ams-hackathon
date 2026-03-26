import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    photoURL: string | null;
    providerData: Array<{ providerId: string }>;
}

interface AuthContextType {
    user: User | null;
    isAuthLoading: boolean;
    signInWithGoogle: () => Promise<void>;
    sendOtp: (phoneNumber: string, recaptchaContainerId: string) => Promise<void>;
    confirmOtp: (otp: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_USER: User = {
    uid: 'guest_user',
    displayName: 'Guest Farmer',
    email: 'guest@agrotalk.local',
    phoneNumber: null,
    photoURL: null,
    providerData: [{ providerId: 'local' }]
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(GUEST_USER);
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    const signInWithGoogle = async () => {
        console.log("Mock Google Sign-in");
        setUser(GUEST_USER);
    };

    const sendOtp = async (phoneNumber: string, recaptchaContainerId: string) => {
        console.log("Mock Send OTP to", phoneNumber);
    };

    const confirmOtp = async (otp: string) => {
        console.log("Mock Confirm OTP", otp);
        setUser(GUEST_USER);
    };

    const logout = async () => {
        console.log("Mock Logout");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthLoading, signInWithGoogle, sendOtp, confirmOtp, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

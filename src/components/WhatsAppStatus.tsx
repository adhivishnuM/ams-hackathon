import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Wifi, WifiOff, QrCode, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import QRCode from 'qrcode';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type WAStatus = 'disconnected' | 'connecting' | 'authenticated' | 'ready' | 'auth_failure';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function WhatsAppStatus({ isOpen, onClose }: Props) {
    const [status, setStatus] = useState<WAStatus>('connecting');
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState('Connecting to WhatsApp bridge...');
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            setStatusMessage('Connected to server. Waiting for WhatsApp...');
        });

        socket.on('disconnect', () => {
            setStatus('disconnected');
            setStatusMessage('Disconnected from server.');
        });

        socket.on('whatsapp-qr', async ({ qr }: { qr: string }) => {
            setStatus('connecting');
            setStatusMessage('Scan this QR code with WhatsApp to connect.');
            try {
                const dataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
                setQrDataUrl(dataUrl);
            } catch (e) {
                console.error('QR render failed', e);
            }
        });

        socket.on('whatsapp-status', ({ status: s, reason, message }: any) => {
            setStatus(s as WAStatus);
            setQrDataUrl(null);
            if (s === 'ready') setStatusMessage('✅ WhatsApp is connected and ready!');
            else if (s === 'authenticated') setStatusMessage('Authenticated. Finishing setup...');
            else if (s === 'auth_failure') setStatusMessage(`Authentication failed: ${message || reason || 'Unknown error'}`);
            else if (s === 'disconnected') setStatusMessage(`Disconnected: ${reason || 'Unknown reason'}`);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const statusColor = {
        ready: 'text-green-500',
        authenticated: 'text-blue-500',
        connecting: 'text-yellow-500',
        disconnected: 'text-red-500',
        auth_failure: 'text-red-500',
    }[status];

    const StatusIcon = {
        ready: CheckCircle,
        authenticated: CheckCircle,
        connecting: Loader2,
        disconnected: WifiOff,
        auth_failure: AlertCircle,
    }[status];

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md mx-auto bg-card rounded-t-3xl border border-border/50 shadow-2xl p-6 pb-8 animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#25D366]/10 flex items-center justify-center border border-[#25D366]/20">
                            <Wifi className="w-5 h-5 text-[#25D366]" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-foreground">WhatsApp Bridge</h2>
                            <p className="text-[11px] text-muted-foreground font-medium">AgroTalk self-message integration</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-muted/40 hover:bg-muted/80 transition-colors"
                    >
                        <X size={18} className="text-muted-foreground" />
                    </button>
                </div>

                {/* Status */}
                <div className={`flex items-center gap-2.5 mb-6 p-3 rounded-xl bg-muted/30 border border-border/40`}>
                    <StatusIcon className={`w-5 h-5 ${statusColor} ${status === 'connecting' ? 'animate-spin' : ''}`} />
                    <p className={`text-[13px] font-semibold ${statusColor}`}>{statusMessage}</p>
                </div>

                {/* QR Code */}
                {qrDataUrl && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-white rounded-2xl shadow-md">
                            <img src={qrDataUrl} alt="WhatsApp QR Code" className="w-56 h-56" />
                        </div>
                        <div className="text-center">
                            <p className="text-[12px] font-bold text-foreground mb-1">How to scan</p>
                            <p className="text-[11px] text-muted-foreground">
                                Open WhatsApp → Settings → Linked Devices → Link a Device
                            </p>
                        </div>
                    </div>
                )}

                {/* Ready state */}
                {status === 'ready' && (
                    <div className="flex flex-col items-center gap-3 py-4">
                        <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center border-2 border-[#25D366]/30">
                            <CheckCircle className="w-8 h-8 text-[#25D366]" />
                        </div>
                        <p className="text-[12px] text-muted-foreground text-center">
                            Send yourself a message on WhatsApp to talk to AgroTalk AI.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { dbService } from '@/services/db';
import { syncService } from '@/services/syncService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ChatItem {
    id: string;
    conversationId?: string;
    query: string;
    response: string;
    timestamp: string;
    type: 'voice' | 'text';
    weatherContext?: any;
    messages?: Array<{ query: string; response: string; timestamp: string; id: string }>;
}

export function useChat() {
    const [history, setHistory] = useState<ChatItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);


    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            // 1. Load from Local DB immediately (Optimistic UI for both online & offline)
            const localHistory = await dbService.getAll('chat_history');

            // Construct history from local DB messages
            // Group messages by conversationId
            const grouped: Record<string, ChatItem> = {};
            for (const msg of localHistory) {
                const convId = msg.conversationId || 'default';
                if (!grouped[convId]) {
                    grouped[convId] = {
                        id: convId,
                        conversationId: convId,
                        query: msg.role === 'user' ? msg.content : '',
                        response: msg.role === 'assistant' ? msg.content : '',
                        timestamp: new Date(msg.timestamp).toISOString(),
                        type: 'text',
                        messages: []
                    };
                }

                // Add to messages array
                if (grouped[convId].messages) {
                    grouped[convId].messages!.push({
                        id: msg.id,
                        query: msg.role === 'user' ? msg.content : '',
                        response: msg.role === 'assistant' ? msg.content : '',
                        timestamp: new Date(msg.timestamp).toISOString()
                    });
                }
            }

            // Sort messages within each conversation
            Object.values(grouped).forEach(item => {
                if (item.messages) {
                    item.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                }
            });

            // Set state from local DB immediately if we have data
            const localData = Object.values(grouped).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            if (localData.length > 0) {
                setHistory(localData);
            }

            if (navigator.onLine) {
                // Background sync (non-blocking)
                syncService.syncChatHistory().then(() => {
                    // Then fetch from API for latest state to ensure consistency
                    return fetch(`${API_BASE_URL}/chat`);
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            setHistory(data.data);
                        }
                    })
                    .catch(err => console.error('Background sync/fetch failed', err));
            }
        } catch (error) {
            console.error('Failed to fetch chat history', error);
        } finally {
            setIsLoading(false);
        }
    };

    const clearHistory = async () => {
        try {
            await fetch(`${API_BASE_URL}/chat`, { method: 'DELETE' });
            setHistory([]);
        } catch (error) {
            console.error('Failed to clear chat history', error);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    return { history, isLoading, fetchHistory, clearHistory };
}

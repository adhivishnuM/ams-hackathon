import { useState, useEffect } from 'react';
import { dbService } from '@/services/db';

export interface AgentOrder {
    id: string;
    crop: string;
    quantity: string;
    location: string;
    price_estimate: string;
    status: string;
    buyer_name: string;
    timestamp: number;
}

export function useOrders() {
    const [orders, setOrders] = useState<AgentOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const allOrders = await dbService.getAllFromIndex('agent_orders', 'by-timestamp');
            // Sort normally descending
            setOrders(allOrders.reverse());
        } catch (err) {
            console.error('Failed to load agent orders:', err);
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOrders();
        // Re-check for new orders every 3s (handles orders placed via voice agent in apiClient)
        const interval = setInterval(loadOrders, 3000);
        return () => clearInterval(interval);
    }, []);

    const addOrder = async (order: AgentOrder) => {
        try {
            await dbService.put('agent_orders', order);
            await loadOrders();
            return true;
        } catch (err) {
            console.error('Failed to add order:', err);
            return false;
        }
    };

    const deleteOrder = async (id: string) => {
        try {
            await dbService.delete('agent_orders', id);
            await loadOrders();
            return true;
        } catch (err) {
            console.error('Failed to delete order:', err);
            return false;
        }
    };

    return {
        orders,
        loading,
        error,
        refresh: loadOrders,
        addOrder,
        deleteOrder
    };
}

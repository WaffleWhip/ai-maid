export interface SystemEvent {
    type: 'thinking' | 'processing' | 'execution' | 'skill' | 'info';
    label: string;
    value: string;
}

let currentTurnEvents: SystemEvent[] = [];

/**
 * System Logger - Centralized event tracking for AI-Maid (Minimalist)
 */
export const logger = {
    clear: () => {
        currentTurnEvents = [];
    },

    /**
     * Record a system event. 
     * Setting type to 'info' with value 'idle' will clear active statuses.
     */
    record: (type: SystemEvent['type'], label: string, value: string) => {
        // If we are setting something to idle or recording a new transient status, 
        // clear existing thinking/processing.
        if (type === 'thinking' || type === 'processing' || (type === 'info' && value === 'idle')) {
            currentTurnEvents = currentTurnEvents.filter(e => e.type !== 'thinking' && e.type !== 'processing');
        }
        
        if (type !== 'info' || value !== 'idle') {
            currentTurnEvents.push({ type, label, value });
        }
        
        console.log(`[system-log] ${type.toUpperCase()} | ${label}: ${value}`);
    },

    getEvents: () => [...currentTurnEvents],

    /**
     * Format events for Discord Embed Description
     */
    formatForDiscord: () => {
        const activeStatus = currentTurnEvents.find(e => 
            (e.type === 'thinking' || e.type === 'processing') && e.value === 'active'
        );

        if (!activeStatus) return "";

        const statusText = activeStatus.type === 'thinking' ? '*Thinking...*' : '*Processing...*';
        return `\n${statusText}`;
    }
};

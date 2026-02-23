import * as pi from '@mariozechner/pi-ai';

// Initialize providers once at core level
pi.registerBuiltInApiProviders();

/**
 * BRIDGE: Stable Types
 */
export type Message = pi.Message;
export type ToolCall = pi.ToolCall;
export type Context = pi.Context;
export type Model = pi.Model<any>;

/**
 * BRIDGE: Model & Provider Management
 */
export function getModel(providerId: string, modelId: string) {
    try {
        return pi.getModel(providerId as any, modelId);
    } catch {
        return null;
    }
}

export function listModels(providerId: string) {
    try {
        return pi.getModels(providerId as any);
    } catch {
        return [];
    }
}

export function getOAuthProviders() {
    return pi.getOAuthProviders();
}

/**
 * BRIDGE: Auth Management
 */
export async function getApiKey(providerId: string, store: Record<string, any>): Promise<{ apiKey: string, updatedStore: Record<string, any> } | null> {
    try {
        const result = await pi.getOAuthApiKey(providerId as any, store);
        if (result) {
            const newStore = { ...store };
            newStore[providerId] = { ...newStore[providerId], ...result.newCredentials };
            return { apiKey: result.apiKey, updatedStore: newStore };
        }
        
        // Fallback for non-OAuth or existing simple keys
        const key = store[providerId]?.access || store[providerId]?.refresh || '';
        return key ? { apiKey: key, updatedStore: store } : null;
    } catch (e) {
        console.error(`[core] failed to get api key for ${providerId}:`, e);
        return null;
    }
}

/**
 * BRIDGE: Completion Engine
 */
export async function complete(model: any, context: pi.Context, apiKey: string) {
    return pi.complete(model, context, { apiKey } as any);
}

/**
 * BRIDGE: Utilities
 */
export function getEnvApiKey(providerId: string) {
    return (pi as any).getEnvApiKey?.(providerId);
}

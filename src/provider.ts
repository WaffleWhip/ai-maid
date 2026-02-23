import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { AUTH_FILE } from './constants';
import * as core from './core';

const AUTH_PATH = join(process.cwd(), AUTH_FILE);
const AGENTS_DIR = join(process.cwd(), 'maid', 'agents');
const SUPPORTED_PROVIDERS = ['github-copilot', 'google-gemini-cli'];

export interface ProviderItem {
    id: string;
    name: string;
    authenticated: boolean;
}

let _cachedStore: Record<string, any> | null = null;

function loadStore(): Record<string, any> {
    if (_cachedStore) return _cachedStore;
    if (existsSync(AUTH_PATH)) {
        try {
            _cachedStore = JSON.parse(readFileSync(AUTH_PATH, 'utf-8'));
            return _cachedStore!;
        } catch {
            return {};
        }
    }
    return {};
}

function saveStore(store: Record<string, any>) {
    _cachedStore = store;
    writeFileSync(AUTH_PATH, JSON.stringify(store, null, 2));
}

export function getAllProviders(): ProviderItem[] {
    const store = loadStore();
    return SUPPORTED_PROVIDERS.map(id => {
        let name = id;
        if (id === 'github-copilot') name = 'GitHub Copilot';
        else if (id === 'google-gemini-cli') name = 'Google Gemini CLI';
        
        return {
            id,
            name,
            authenticated: !!(store[id]?.refresh || store[id]?.access)
        };
    });
}

export function getActiveProvider(): string | null {
    const store = loadStore();
    return store._activeProvider || null;
}

export function isApiKeyRequired(providerId: string): boolean {
    return providerId !== 'google-gemini-cli';
}

export function shouldSkipPrompt(providerId: string): boolean {
    return providerId === 'github-copilot';
}

export function setActiveProvider(id: string) {
    const store = loadStore();
    store._activeProvider = id;
    saveStore(store);
}

export function getAvailableAgents(): string[] {
    if (!existsSync(AGENTS_DIR)) return ['GENERAL'];
    try {
        return readdirSync(AGENTS_DIR)
            .filter(f => f.endsWith('.md'))
            .map(f => f.replace('.md', ''));
    } catch {
        return ['GENERAL'];
    }
}

export function getActiveAgent(): string {
    const store = loadStore();
    return store._activeAgent || 'GENERAL';
}

export function setActiveAgent(agentName: string) {
    const store = loadStore();
    store._activeAgent = agentName;
    saveStore(store);
}

export async function loginProvider(
    id: string,
    onAuthUrl: (url: string, instructions?: string) => void,
    onManualCodeInput: () => Promise<string>,
    onPrompt: (options: { message: string, placeholder?: string, defaultValue?: string }) => Promise<string>
): Promise<boolean> {
    const oauthProviders = core.getOAuthProviders();
    const oauthProvider = oauthProviders.find(p => p.id === id);
    if (!oauthProvider) return false;

    try {
        const credentials = await oauthProvider.login({
            onAuth: (info: { url: string, instructions?: string }) => onAuthUrl(info.url, info.instructions),
            onPrompt: onPrompt,
            onProgress: (msg: string) => console.log(`[auth] ${msg}`),
            onManualCodeInput: onManualCodeInput
        });

        const store = loadStore();
        store[id] = { ...store[id], ...credentials };
        saveStore(store);
        return true;
    } catch (error) {
        console.error(`[auth] login failed for ${id}:`, error);
        return false;
    }
}

export function getProviderModels(providerId: string) {
    return core.listModels(providerId);
}

export function getSelectedModel(providerId: string): string | null {
    const store = loadStore();
    return store[providerId]?.selectedModel || null;
}

export function setSelectedModel(providerId: string, modelId: string) {
    const store = loadStore();
    if (!store[providerId]) store[providerId] = {};
    store[providerId].selectedModel = modelId;
    saveStore(store);
}

export function getModelInfo(providerId: string, modelId: string) {
    return core.getModel(providerId, modelId);
}

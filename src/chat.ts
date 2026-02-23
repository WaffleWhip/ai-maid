import { getModel as getPiModel, complete, type Message, type ToolCall } from "@mariozechner/pi-ai";
import { readFileSync, existsSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import * as core from "./core";
import { getActiveAgent, getActiveProvider, getSelectedModel, getModelInfo, isApiKeyRequired } from "./provider";
import { toolMap } from "./tools";
import { AUTH_FILE } from "./constants";
import { logger } from "./log";

const AGENTS_DIR = join(process.cwd(), "maid", "agents");
const SKILLS_DIR = join(process.cwd(), "maid", "skills");
const TOOLS_DIR = join(process.cwd(), "maid", "tools");
const AUTH_PATH = join(process.cwd(), AUTH_FILE);

const globalHistory: core.Message[] = [];

export interface ChatResult {
    text: string;
    skills: string[];
    tools: string[];
    usage: {
        model: string;
        current: number;
        max: number;
        percent: number;
    };
}

function countTokens(text: any): number {
    const str = typeof text === 'string' ? text : JSON.stringify(text || "");
    return Math.ceil(str.length / 4);
}

function getRequestedItems(agentContent: string, dir: string, prefix: string): { context: string, loaded: string[] } {
    if (!existsSync(dir)) return { context: "", loaded: [] };

    const hasAllTag = agentContent.includes(`[[${prefix}:all]]`);
    const availableFolders = readdirSync(dir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(d => d.name);

    if (hasAllTag && prefix === "skill") {
        let xmlContext = "\n\nThe following modules provide specialized instructions. Use 'run_shell_command' to read a module's SKILL.md file when the task matches its description.\n\n<available_skills>\n";
        for (const name of availableFolders) {
            const skillPath = join(dir, name, "SKILL.md");
            if (existsSync(skillPath)) {
                const content = readFileSync(skillPath, "utf-8");
                const descMatch = content.match(/description:\s*(.*)/i) || [null, `Specialized module for ${name}`];
                xmlContext += `  <skill>\n    <name>${name}</name>\n    <description>${descMatch[1].trim()}</description>\n    <location>${skillPath}</location>\n  </skill>\n`;
            }
        }
        xmlContext += "</available_skills>";
        return { context: xmlContext, loaded: [] };
    }

    const loadedItems: string[] = [];
    let itemsContext = "";
    const itemTags = agentContent.match(new RegExp(`\\[\\[${prefix}:(\\w+)\\]\\]`, "g")) || [];
    const itemsToLoad = [...new Set(itemTags.map(tag => tag.replace(`[[${prefix}:`, "").replace("]]", "")))];

    if (itemsToLoad.length > 0) {
        itemsContext = `\n\n**Active ${prefix.charAt(0).toUpperCase() + prefix.slice(1)}s**`;
        for (const itemName of itemsToLoad) {
            const descPath = join(dir, itemName, prefix === "skill" ? "SKILL.md" : "TOOL.md");
            if (existsSync(descPath)) {
                itemsContext += `\n\n[${itemName.toUpperCase()}]\n${readFileSync(descPath, "utf-8")}`;
                loadedItems.push(itemName);
            }
        }
    }
    return { context: itemsContext, loaded: loadedItems };
}

export async function clearSession() {
    globalHistory.length = 0;
}

export async function chat(
    sessionId: string, 
    prompt: string, 
    userName?: string,
    onUpdate?: (result: ChatResult) => void
): Promise<ChatResult> {
    logger.clear();
    
    const providerId = getActiveProvider() || "google-gemini-cli";
    const modelId = getSelectedModel(providerId) || "";
    const model = getModelInfo(providerId, modelId);
    if (!model) throw new Error("model not found");

    const store = existsSync(AUTH_PATH) ? JSON.parse(readFileSync(AUTH_PATH, 'utf-8')) : {};
    const authResult = await core.getApiKey(providerId, store);
    
    if (!authResult && isApiKeyRequired(providerId)) {
        throw new Error(`provider ${providerId} is not authenticated. use /auth to login.`);
    }

    const apiKey = authResult?.apiKey || '';
    if (authResult?.updatedStore) {
        writeFileSync(AUTH_PATH, JSON.stringify(authResult.updatedStore, null, 2));
    }

    const activeAgent = getActiveAgent();
    const agentPath = join(AGENTS_DIR, `${activeAgent}.md`);
    let baseInstructions = existsSync(agentPath) ? readFileSync(agentPath, "utf-8").trim() : "";
    
    if (!baseInstructions) {
        const defaultPath = join(AGENTS_DIR, "GENERAL.md");
        baseInstructions = existsSync(defaultPath) ? readFileSync(defaultPath, "utf-8").trim() : "You are AI-Maid.";
    }
    const skills = getRequestedItems(baseInstructions, SKILLS_DIR, "skill");
    const toolItems = getRequestedItems(baseInstructions, TOOLS_DIR, "tool");
    
    const systemPrompt = baseInstructions + skills.context + toolItems.context;

    globalHistory.push({ role: "user", content: prompt, timestamp: Date.now() });

    const maxTokens = ((model as any).contextWindow || 32000) * 0.8;
    while (globalHistory.reduce((sum, m) => sum + countTokens(m.content), 0) > maxTokens && globalHistory.length > 1) {
        globalHistory.shift();
    }

    const piTools = Object.values(toolMap).map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
    }));

    let loops = 0;
    let finalOutput = "";
    let activeSkills = [...skills.loaded];
    let usedTools: string[] = [];

    const buildResult = (text: string): ChatResult => {
        const currentUsage = globalHistory.reduce((sum, m) => sum + countTokens(m.content), 0);
        return {
            text: text, // No placeholder here, logger handles the Thinking/Processing text
            skills: [...new Set(activeSkills)],
            tools: [...new Set(usedTools)],
            usage: {
                model: (model as any).name || modelId,
                current: currentUsage,
                max: (model as any).contextWindow || 32000,
                percent: Math.round((currentUsage / ((model as any).contextWindow || 32000)) * 100)
            }
        };
    };

    try {
        while (loops < 10) {
            loops++;
            
            // Set status to Thinking
            logger.record('thinking', 'Status', 'active');
            if (onUpdate) onUpdate(buildResult(finalOutput));

            const response = await core.complete(model, {
                systemPrompt,
                messages: globalHistory,
                tools: piTools
            }, apiKey);

            globalHistory.push({ ...response, role: "assistant" });

            // IMMEDIATELY set to idle to clear thinking status in UI
            logger.record('info', 'Status', 'idle'); 

            const text = response.content.filter(p => p.type === "text").map(p => (p as any).text).join("");
            if (text) finalOutput += (finalOutput ? "\n" : "") + text;

            const toolCalls = response.content.filter(p => p.type === "toolCall") as core.ToolCall[];
            if (toolCalls.length > 0) {
                // Set status to Processing
                logger.record('processing', 'Status', 'active');
                if (onUpdate) onUpdate(buildResult(finalOutput));

                const toolResults = await Promise.all(toolCalls.map(async (tc) => {
                    usedTools.push(tc.name);
                    const tool = toolMap[tc.name];
                    if (tool) {
                        const result = await tool.handler(tc.arguments);
                        if (tc.name === "get_skill_info") {
                            activeSkills.push(tc.arguments.skillName);
                        }
                        return { tc, result };
                    }
                    return { tc, result: `Tool ${tc.name} not found.` };
                }));

                for (const { tc, result } of toolResults) {
                    globalHistory.push({
                        role: "toolResult",
                        toolCallId: tc.id,
                        toolName: tc.name,
                        content: [{ type: "text", text: result }],
                        timestamp: Date.now()
                    } as any);
                }
                
                // Keep status as Processing while waiting for next turn if text is still empty
                if (onUpdate) onUpdate(buildResult(finalOutput));
            } else {
                break;
            }
        }

        return buildResult(finalOutput);
    } catch (error: any) {
        console.error(`[chat] error:`, error);
        return { text: `error: ${error.message}`, skills: [], tools: [], usage: { model: "error", current: 0, max: 0, percent: 0 } };
    }
}

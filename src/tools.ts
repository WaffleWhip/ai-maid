import { exec } from "child_process";
import { promisify } from "util";
import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);
const SKILLS_DIR = join(process.cwd(), "maid", "skills");

/**
 * Real Shell Execution Tool
 */
const run_shell_command = {
    name: "run_shell_command",
    description: "Execute a shell command inside the Debian Trixie container. Use this for networking, system management, and file operations.",
    parameters: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "The full shell command to run (e.g., 'ip addr', 'apt-get install -y ping')"
            }
        },
        required: ["command"]
    },
    handler: async ({ command }: { command: string }) => {
        try {
            console.log(`[shell] executing: ${command}`);
            const { stdout, stderr } = await execAsync(command);
            return JSON.stringify({
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: 0
            });
        } catch (error: any) {
            return JSON.stringify({
                stdout: error.stdout?.trim() || "",
                stderr: error.stderr?.trim() || error.message,
                exitCode: error.code || 1
            });
        }
    }
};

/**
 * Skill Discovery Tool
 */
const list_available_skills = {
    name: "list_available_skills",
    description: "List the names of all specialized operational modules (skills) available to you.",
    parameters: { type: "object", properties: {} },
    handler: async () => {
        if (!existsSync(SKILLS_DIR)) return "No skills available.";
        const folders = readdirSync(SKILLS_DIR, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);
        return `Available modules: ${folders.join(", ")}. Use 'get_skill_info' to read details.`;
    }
};

/**
 * Skill Loading Tool
 */
const get_skill_info = {
    name: "get_skill_info",
    description: "Get detailed technical documentation and execution patterns for a specific operational module.",
    parameters: {
        type: "object",
        properties: {
            skillName: {
                type: "string",
                description: "The name of the module to load (e.g., 'ssh', 'shell')"
            }
        },
        required: ["skillName"]
    },
    handler: async ({ skillName }: { skillName: string }) => {
        const skillPath = join(SKILLS_DIR, skillName, "SKILL.md");
        if (existsSync(skillPath)) {
            return readFileSync(skillPath, "utf-8");
        }
        return `Module '${skillName}' not found.`;
    }
};

export const toolMap: Record<string, any> = {
    run_shell_command,
    list_available_skills,
    get_skill_info
};

export const tools = Object.values(toolMap).map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters
}));

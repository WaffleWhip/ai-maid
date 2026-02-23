# AI-Maid

AI-Maid is an advanced general-purpose autonomous agent orchestrator built on the native **pi-ai** engine. It provides a clean, efficient, and action-oriented interface for system administration, network management, and general user assistance.

## Key Features

- **Native pi-ai Engine**: High-performance agentic loop with support for multiple providers (Gemini, Claude, Copilot).
- **Dynamic Skill Discovery**: Specialized modules (e.g., SSH, Shell) are loaded on-demand using XML metadata to save tokens.
- **Action-Oriented**: Equipped with a robust `run_shell_command` tool for direct system interaction.
- **Discord Integration**: Rich, real-time UI updates with context usage tracking and clean vertical data formatting.
- **Dockerized**: Fully containerized environment using Debian Trixie for modern technical capabilities.
- **Language Adaptive**: Seamlessly switches between languages based on user input.

## Architecture

AI-Maid follows a modular "Bridge" architecture:
- `src/core.ts`: The central gateway to the `pi-ai` library.
- `src/chat.ts`: Manages the agentic loop, history trimming, and skill loading.
- `src/log.ts`: Centralized system event logging for monitoring.
- `maid/agents/`: Persona and instruction definitions (Default: `GENERAL.md`).
- `maid/skills/`: specialized technical modules.

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Bun (for local development)

### Setup
1. Clone the repository.
2. Create a `.env` file with your `DISCORD_TOKEN`.
3. Run the orchestrator:
   ```bash
   docker compose up -d --build
   ```

### Commands
- `/auth`: Authenticate AI providers.
- `/model`: Select and configure AI models.
- `/agent`: Switch between different agent personas.
- `/clear`: Reset conversation history.

## Environment Responsibility
AI-Maid is designed to be self-sufficient. It can install necessary system tools (via `apt-get`) and manage its own environment based on the task at hand.

---
Built with pride for efficient automation.

description: Advanced OLT (Optical Line Terminal) management for Huawei, ZTE, FiberHome, and Nokia.

# SKILL: OLT MANAGEMENT
Use this skill to manage OLT devices using the dedicated Python-based automation engine located in `/app/olt`.

## AVAILABLE TOOLS (CLI)
You can execute these tools via `run_shell_command` using `uv run` inside the `/app/olt` directory.

### 1. Inventory Management (`olt-inv`)
Manage the database of OLT devices.
- **Add OLT**: `uv run olt-inv add --name NAME --ip IP --user USER --pass PASS`
- **List OLTs**: `uv run olt-inv query`
- **Get Specific OLT**: `uv run olt-inv query --id ID`
- **Delete OLT**: `uv run olt-inv delete ID`

### 2. Command Execution (`olt-exec`)
Execute commands on OLTs. This tool uses stateful background sessions (daemons) that stay alive for 5 minutes.
- **Run Command**: `uv run olt-exec run ID --cmd "COMMAND"`
  - *Example*: `uv run olt-exec run 1 --cmd "display ont info 0 1 0 all"`
- **Kill Session**: `uv run olt-exec kill ID`

## SUPPORTED PLATFORMS
- Huawei (Telnet/SSH)
- ZTE (Telnet/SSH)
- FiberHome (Telnet)
- Nokia (Telnet/SSH)

## GUIDELINES
- **Path**: Always run commands from the `/app/olt` directory or use absolute paths.
- **Inventory First**: Before running commands, ensure the OLT is added to the inventory.
- **Stateful Speed**: The first command to an OLT might take ~10 seconds to initialize the daemon. Subsequent commands will be near-instant.
- **Output**: The tools return JSON or formatted text. Parse and summarize for the user.
- **Dependency**: If `uv` is missing, install it using `curl -LsSf https://astral.sh/uv/install.sh | sh`.

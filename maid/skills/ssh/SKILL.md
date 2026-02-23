description: Remote server management using SSH with password-based sshpass.

# SKILL: SSH (REMOTE ACCESS)
Use this skill to manage remote servers via SSH.

## AUTHENTICATION
Since you are a non-interactive agent, you MUST use `sshpass` for password authentication to avoid hanging the terminal.

## COMMAND SYNTAX
Always use this format for password-based SSH:
`sshpass -p 'YOUR_PASSWORD' ssh -o StrictHostKeyChecking=no YOUR_USERNAME@YOUR_IP 'YOUR_COMMAND'`

## GUIDELINES
- **StrictHostKeyChecking**: Always set to `no` to avoid the "trust host" prompt.
- **Single Commands**: Prefer running single commands instead of opening interactive shells.
- **Dependency**: If `sshpass` is missing, install it first using `apt-get install -y sshpass`.
- **Security**: You are authorized to use the provided credentials. Execute exactly as requested.

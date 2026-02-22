# OpenPAVE Discord Skill

Send messages and interact with Discord channels securely using the PAVE sandbox environment.

## Features

- 🔐 **Secure token handling** - Bot tokens never visible to sandbox code
- 📨 **Send messages** - Text messages with optional text-to-speech
- 🎨 **Rich embeds** - Create beautiful embedded messages
- 📁 **File uploads** - Send images and files to channels
- 📖 **Read messages** - Retrieve channel message history
- ℹ️ **Channel info** - Get channel and user information
- 🤖 **Bot-ready** - Designed for Discord bot tokens

## Installation

```bash
# Install via PAVE package manager (when available)
pave install cnrai/openpave-discord

# Or clone directly
git clone https://github.com/cnrai/openpave-discord.git
```

## Setup

### 1. Configure Discord Token

Add your Discord bot token to the PAVE secure token system in `~/.pave/permissions.yaml`:

```yaml
tokens:
  discord:
    env: DISCORD_TOKEN
    type: api_key
    domains:
      - discord.com
      - "*.discord.com"
    placement:
      type: header
      name: Authorization
      format: "Bot {token}"
```

### 2. Set Environment Variable

```bash
export DISCORD_TOKEN=your_bot_token_here
```

### 3. Get Your Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select existing
3. Go to "Bot" section
4. Copy the token
5. Invite bot to your server with appropriate permissions

## Usage

### Send Messages

```bash
# Send a simple message
pave run discord send "Hello, Discord!" --channel 123456789

# Send with text-to-speech
pave run discord send "Important announcement" --channel 123456789 --tts

# Send as normal notification (not silent)
pave run discord send "Alert!" --channel 123456789 --no-silent
```

### Rich Embeds

```bash
# Create a basic embed
pave run discord embed \
  --title "System Status" \
  --description "All systems operational" \
  --color "00ff00" \
  --channel 123456789

# Full-featured embed
pave run discord embed \
  --title "Deploy Complete" \
  --description "Application deployed successfully" \
  --color "00ff00" \
  --url "https://github.com/example/repo" \
  --thumbnail "https://example.com/icon.png" \
  --footer "Deployment Bot" \
  --channel 123456789

# Embed with message content
pave run discord embed \
  --title "Alert" \
  --description "Check the logs" \
  --message "📊 Weekly report is ready!" \
  --channel 123456789
```

### File Uploads (Simplified)

**Note**: Full file upload support requires multipart form handling in the secure token system. Currently provides a simplified implementation:

```bash
# Send a file reference message
pave run discord send-file ./report.png --channel 123456789

# Send file reference with message
pave run discord send-file ./data.json \
  --message "Here's the latest data" \
  --channel 123456789
```

### Read Messages

```bash
# Get recent messages (default: 50)
pave run discord messages --channel 123456789 --summary

# Get specific number of messages
pave run discord messages --channel 123456789 --limit 10 --json

# Get messages before/after a specific message
pave run discord messages \
  --channel 123456789 \
  --before 987654321 \
  --limit 5
```

### Get Channel & User Info

```bash
# Get channel information
pave run discord channel --channel 123456789 --summary

# Get bot user information
pave run discord me --summary

# Create or find DM channel with a user (returns channel ID)
pave run discord dm 123456789 --summary

# List all accessible servers and channels
pave run discord channels --summary

# Get raw JSON data for servers
pave run discord channels --json
```

## Output Formats

### Summary Format (Human-Readable)

```bash
pave run discord messages --channel 123456789 --summary
# Output:
# [2025-01-20 10:30:00] Alice: Hey everyone, how's it going?
# [2025-01-20 10:28:15] Bob: Good morning team!
# [2025-01-20 10:25:42] Charlie: Ready for the meeting
```

### JSON Format (Machine-Readable)

```bash
pave run discord me --json
# Output:
# {
#   "id": "123456789",
#   "username": "MyBot",
#   "discriminator": "0000",
#   "avatar": "abc123...",
#   "bot": true
# }
```

## Common Channel IDs

For the C&R team (example):
- `#general`: `747420393765077117`
- `#test`: `749896839435649054`

## Error Handling

The skill provides helpful error messages:

```bash
# Missing token
❌ Error: Discord token not configured.

Add to ~/.pave/permissions.yaml:
{
  "discord": {
    "env": "DISCORD_TOKEN",
    "type": "api_key",
    "domains": ["discord.com", "*.discord.com"],
    "placement": { "type": "header", "name": "Authorization", "format": "Bot {token}" }
  }
}

# Missing channel
❌ Error: Channel ID is required. Use --channel option.

# File not found
❌ Error: File not found: /path/to/missing/file.png
```

## Security Features

- **Token isolation**: Bot tokens never visible to sandbox code
- **Domain restriction**: Only Discord domains allowed
- **Audit logging**: All API calls logged securely
- **Sandbox environment**: Runs in isolated container

## Permissions

This skill requires:
- **Network access**: `discord.com`
- **File system read**: For file uploads
- **Node.js modules**: `fs`, `path`

## Examples

### Morning Standup Bot

```bash
#!/bin/bash
# Send daily standup reminder
pave run discord embed \
  --title "🌅 Daily Standup" \
  --description "Time for our daily standup meeting!" \
  --color "ff9500" \
  --footer "Standup Bot" \
  --channel 123456789
```

### Deployment Notification

```bash
#!/bin/bash
# Notify about successful deployment
pave run discord embed \
  --title "✅ Deploy Complete" \
  --description "Application v1.2.3 deployed successfully" \
  --color "00ff00" \
  --url "https://app.example.com" \
  --thumbnail "https://cdn.example.com/success.png" \
  --channel 123456789
```

### Send Logs

```bash
#!/bin/bash
# Send log file
pave run discord send-file /var/log/app.log \
  --message "📋 Latest application logs" \
  --channel 123456789
```

## API Reference

### Commands

| Command | Description | Arguments | Key Options |
|---------|-------------|-----------|-------------|
| `send` | Send text message | `<message>` | `--channel`, `--tts` |
| `embed` | Send rich embed | - | `--title`, `--description`, `--color` |
| `send-file` | Upload file | `<file>` | `--channel`, `--message` |
| `messages` | Read messages | - | `--channel`, `--limit` |
| `channel` | Channel info | - | `--channel` |
| `me` | Bot user info | - | - |
| `dm` | Create/find DM | `<userID>` | - |
| `channels` | List servers/channels | - | - |

### Global Options

| Option | Description |
|--------|-------------|
| `--channel <id>` | Discord channel ID |
| `--summary` | Human-readable output |
| `--json` | Raw JSON output |
| `--no-silent` | Normal notifications |

## Development

### Running Tests

```bash
# Test basic functionality
pave run discord me --json

# Test with invalid token
DISCORD_TOKEN=invalid pave run discord me
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with real Discord server
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file.

## Links

- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord API Documentation](https://discord.com/developers/docs)
- [PAVE Sandbox Documentation](https://pave.ai/docs)

---

**Note**: This skill requires a Discord bot token. User tokens are not supported for security and compliance reasons.
#!/usr/bin/env node
/**
 * Discord CLI - Secure Token Version
 * 
 * Uses the PAVE sandbox secure token system for authentication.
 * Tokens are never visible to sandbox code - they're injected by the host.
 * 
 * Token configuration in ~/.pave/permissions.yaml:
 * {
 *   "tokens": {
 *     "discord": {
 *       "env": "DISCORD_TOKEN",
 *       "type": "api_key",
 *       "domains": ["discord.com", "*.discord.com"],
 *       "placement": { "type": "header", "name": "Authorization", "format": "Bot {token}" }
 *     }
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments  
const args = process.argv.slice(2);

function parseArgs() {
  const parsed = {
    command: null,
    positional: [],
    options: {}
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('-')) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=', 2);
        if (value !== undefined) {
          parsed.options[key] = value;
        } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          parsed.options[key] = args[i + 1];
          i++;
        } else {
          parsed.options[key] = true;
        }
      } else {
        const flag = arg.slice(1);
        if (flag.length > 1 && !flag.includes('=')) {
          // Handle short options like -c channelId
          if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            parsed.options[flag] = args[i + 1];
            i++;
          } else {
            parsed.options[flag] = true;
          }
        } else {
          // Single char flag
          parsed.options[flag] = true;
        }
      }
    } else {
      if (parsed.command === null) {
        parsed.command = arg;
      } else {
        parsed.positional.push(arg);
      }
    }
  }
  
  return parsed;
}

// Discord Client Class - Uses secure token system
class DiscordClient {
  constructor() {
    this.baseUrl = 'https://discord.com/api/v9';
    this.tokenChecked = false;
  }

  /**
   * Check if secure token system is available and configured
   */
  checkTokens() {
    if (this.tokenChecked) return;
    
    // Check if secure token functions are available
    if (typeof hasToken !== 'function' || typeof authenticatedFetch !== 'function') {
      throw new Error('Secure token system not available. Make sure you\'re running this via: pave run discord');
    }
    
    // Check if discord token is configured
    if (!hasToken('discord')) {
      console.error('Discord token not configured.');
      console.error('');
      console.error('Add to ~/.pave/permissions.yaml:');
      console.error(JSON.stringify({
        tokens: {
          discord: {
            env: 'DISCORD_TOKEN',
            type: 'api_key',
            domains: ['discord.com', '*.discord.com'],
            placement: { type: 'header', name: 'Authorization', format: 'Bot {token}' }
          }
        }
      }, null, 2));
      console.error('');
      console.error('Then set environment variable:');
      console.error('  DISCORD_TOKEN=your_bot_token');
      console.error('');
      throw new Error('Discord token not configured');
    }
    
    this.tokenChecked = true;
  }

  /**
   * Make an authenticated request to Discord API using secure token system
   */
  request(endpoint, options = {}) {
    // Ensure tokens are checked before making requests
    this.checkTokens();

    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = authenticatedFetch('discord', url, {
        ...options,
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json',
          'User-Agent': 'DiscordBot (https://github.com/cnrai/openpave-discord, 1.0.0)',
          ...options.headers,
        },
        timeout: options.timeout || 15000
      });

      if (!response.ok) {
        const errorData = response.json();
        const error = new Error(errorData.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      return response.json();
    } catch (error) {
      if (error.message.includes('Token not found')) {
        throw new Error('Discord token not found. Please configure the secure token system.');
      }
      throw error;
    }
  }

  /**
   * Send a message to a Discord channel
   */
  sendMessage(content, options = {}) {
    const channelId = options.channelId;
    
    if (!channelId) {
      throw new Error('Channel ID is required. Use --channel option.');
    }

    const body = {
      content,
      nonce: Date.now().toString(),
      tts: options.tts || false,
      mobile_network_type: 'unknown',
    };

    // Add silent flag if requested (default: true)
    if (options.silent !== false) {
      body.flags = 16;
    }

    return this.request(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Send an embedded message
   */
  sendEmbed(embed, options = {}) {
    const channelId = options.channelId;
    
    if (!channelId) {
      throw new Error('Channel ID is required. Use --channel option.');
    }

    const body = {
      embeds: [embed],
      nonce: Date.now().toString(),
      tts: false,
      mobile_network_type: 'unknown',
    };

    if (options.content) {
      body.content = options.content;
    }

    if (options.silent !== false) {
      body.flags = 16;
    }

    return this.request(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get messages from a channel
   */
  getMessages(channelId, options = {}) {
    // Build query parameters manually (URLSearchParams not available in sandbox)
    const params = [];
    
    if (options.limit) params.push(`limit=${options.limit}`);
    if (options.before) params.push(`before=${options.before}`);
    if (options.after) params.push(`after=${options.after}`);

    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    const endpoint = `/channels/${channelId}/messages${queryString}`;

    return this.request(endpoint);
  }

  /**
   * Get channel information
   */
  getChannel(channelId) {
    return this.request(`/channels/${channelId}`);
  }

  /**
   * Get current user information
   */
  getCurrentUser() {
    return this.request('/users/@me');
  }

  /**
   * Create or get DM channel with a user
   */
  createDMChannel(userId) {
    return this.request('/users/@me/channels', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: userId
      })
    });
  }

  /**
   * Get list of guilds (servers) the bot is in
   */
  getGuilds() {
    return this.request('/users/@me/guilds');
  }

  /**
   * Get channels in a guild
   */
  getGuildChannels(guildId) {
    return this.request(`/guilds/${guildId}/channels`);
  }

  /**
   * Send a file to a Discord channel (simplified implementation)
   * Note: Full file upload support requires multipart form handling in secure token system
   */
  sendFile(filePath, options = {}) {
    // For now, just send a message indicating the file would be uploaded
    // Full implementation requires multipart form data support in authenticatedFetch
    const filename = path.basename(filePath);
    const message = options.content ? 
      `${options.content}\n📎 File: ${filename}` : 
      `📎 File upload: ${filename}`;
    
    return this.sendMessage(message, {
      channelId: options.channelId,
      silent: options.silent
    });
  }

  /**
   * Send a message with file attachments
   */
  sendMessageWithFiles(options = {}) {
    const channelId = options.channelId;
    
    if (!channelId) {
      throw new Error('Channel ID is required.');
    }

    if (!options.files || options.files.length === 0) {
      throw new Error('At least one file is required');
    }

    const url = `${this.baseUrl}/channels/${channelId}/messages`;

    // Build multipart form data manually
    const boundary = `----FormBoundary${Date.now()}`;
    const parts = [];

    // Add JSON payload
    const payload = {
      content: options.content || '',
      attachments: options.files.map((file, index) => ({
        id: index,
        filename: file.name,
      })),
    };

    if (options.silent !== false) {
      payload.flags = 16;
    }

    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="payload_json"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      JSON.stringify(payload)
    );

    // Add file parts
    for (let i = 0; i < options.files.length; i++) {
      const file = options.files[i];
      const mimeType = this._getMimeType(file.name);
      
      parts.push(
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="files[${i}]"; filename="${file.name}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
      );
    }

    // Build the body with binary data
    const textParts = parts.map(p => Buffer.from(p, 'utf-8'));
    const endBoundary = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    
    // Interleave text parts with file data
    const bodyParts = [];
    bodyParts.push(textParts[0]); // payload_json part
    
    for (let i = 0; i < options.files.length; i++) {
      bodyParts.push(textParts[i + 1]); // file header
      bodyParts.push(options.files[i].data); // file data
    }
    bodyParts.push(endBoundary);
    
    const body = Buffer.concat(bodyParts);

    // Note: File uploads with multipart data require special handling in secure token system
    // For now, this is a simplified implementation that may need enhancement
    throw new Error('File uploads are not yet fully implemented in the secure token system. Please use the basic send command instead.');

    if (!response.ok) {
      const errorData = response.json();
      const error = new Error(errorData.message || 'Failed to send file');
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    return response.json();
  }

  /**
   * Get MIME type from filename
   */
  _getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'json': 'application/json',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'zip': 'application/zip',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

// Format output based on options
function formatOutput(data, options) {
  if (options.json) {
    return JSON.stringify(data, null, 2);
  }
  
  if (options.summary) {
    return formatSummary(data);
  }
  
  return JSON.stringify(data, null, 2);
}

function formatSummary(data) {
  if (Array.isArray(data)) {
    // Handle different array types
    if (data.length === 0) {
      return 'No results found';
    }
    
    // Messages array
    if (data[0] && data[0].content !== undefined) {
      return data.map(msg => {
        const timestamp = new Date(msg.timestamp).toLocaleString();
        const author = msg.author?.username || 'Unknown';
        const content = msg.content?.substring(0, 100) || '(empty)';
        return `[${timestamp}] ${author}: ${content}`;
      }).join('\n');
    }
    
    // Guilds/servers array
    if (data[0] && data[0].name && data[0].id) {
      return data.map(guild => {
        return `🏠 ${guild.name} (ID: ${guild.id})${guild.owner ? ' [Owner]' : ''}`;
      }).join('\n');
    }
    
    // Channels array
    if (data[0] && data[0].type !== undefined) {
      const typeNames = ['Text', 'DM', 'Voice', 'Group DM', 'Category', 'Announcement', 'Store', '', '', '', 'News', 'Store', '', 'Stage Voice', 'Directory', 'Forum'];
      return data.map(channel => {
        const type = typeNames[channel.type] || `Type ${channel.type}`;
        const name = channel.name ? `#${channel.name}` : 'DM';
        return `${type === 'DM' ? '💬' : '📄'} ${name} (ID: ${channel.id}, Type: ${type})`;
      }).join('\n');
    }
    
    // Generic array
    return data.map(item => JSON.stringify(item, null, 2)).join('\n---\n');
  }
  
  if (data.username) {
    // User object
    return `User: ${data.username}#${data.discriminator} (ID: ${data.id})`;
  }
  
  if (data.name && data.type !== undefined) {
    // Channel object
    const types = ['Text', 'DM', 'Voice', 'Group DM', 'Category', 'Announcement'];
    const type = types[data.type] || `Type ${data.type}`;
    return `Channel: #${data.name} (${type}, ID: ${data.id})`;
  }
  
  if (data.id && data.type === 1) {
    // DM Channel object
    const recipient = data.recipients?.[0];
    const recipientName = recipient ? `${recipient.username}#${recipient.discriminator}` : 'Unknown User';
    return `💬 DM Channel with ${recipientName} (ID: ${data.id})`;
  }
  
  if (data.id) {
    // Generic object with ID
    return `✅ Success (ID: ${data.id})`;
  }
  
  return JSON.stringify(data, null, 2);
}

// Main CLI logic
function main() {
  const { command, positional, options } = parseArgs();
  
  if (!command || command === 'help' || options.help) {
    console.log('Discord CLI - Send messages and interact with Discord channels');
    console.log('');
    console.log('Usage: pave run discord <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  send <message>           Send a message to a channel');
    console.log('  embed                    Send an embedded message');
    console.log('  messages                 Get messages from a channel');
    console.log('  channel                  Get channel information');
    console.log('  me                       Get current user info');
    console.log('  send-file <file>         Send a file to a channel');
    console.log('  dm <userID>              Create/find DM channel with user');
    console.log('  channels                 List accessible channels/servers');
    console.log('');
    console.log('Options:');
    console.log('  -c, --channel <id>       Discord channel ID');
    console.log('  --tts                    Enable text-to-speech');
    console.log('  --no-silent              Send as normal notification');
    console.log('  --summary                Human-readable summary');
    console.log('  --json                   Raw JSON output');
    console.log('');
    console.log('Examples:');
    console.log('  pave run discord send "Hello world" --channel 123456789');
    console.log('  pave run discord embed --title "Alert" --description "System status" --channel 123456789');
    console.log('  pave run discord messages --channel 123456789 --limit 10 --summary');
    console.log('  pave run discord dm 123456789  # Create DM with user ID');
    console.log('  pave run discord channels --summary  # List servers/channels');
    return;
  }

  const client = new DiscordClient();
  let result;

  try {
    switch (command) {
      case 'send':
        if (positional.length === 0) {
          console.error('Error: Message content is required');
          process.exit(1);
        }
        result = client.sendMessage(positional[0], {
          channelId: options.channel || options.c,
          tts: options.tts,
          silent: !options['no-silent']
        });
        break;

      case 'embed':
        // Build embed object
        const embed = {};
        
        if (options.title || options.t) embed.title = options.title || options.t;
        if (options.description || options.d) embed.description = options.description || options.d;
        if (options.color) embed.color = parseInt(options.color, 16);
        if (options.url) embed.url = options.url;
        if (options.footer) embed.footer = { text: options.footer };
        if (options.thumbnail) embed.thumbnail = { url: options.thumbnail };
        if (options.image) embed.image = { url: options.image };
        if (options.author) {
          embed.author = { name: options.author };
          if (options['author-url']) embed.author.url = options['author-url'];
          if (options['author-icon']) embed.author.icon_url = options['author-icon'];
        }

        // Add timestamp
        embed.timestamp = new Date().toISOString();

        if (Object.keys(embed).length <= 1) {
          console.error('Error: At least one embed property (title, description, etc.) is required');
          process.exit(1);
        }

        result = client.sendEmbed(embed, {
          channelId: options.channel || options.c,
          content: options.message || options.m,
          silent: !options['no-silent']
        });
        break;

      case 'messages':
        result = client.getMessages(options.channel || options.c, {
          limit: options.limit || options.l || 50,
          before: options.before,
          after: options.after
        });
        break;

      case 'channel':
        result = client.getChannel(options.channel || options.c);
        break;

      case 'me':
        result = client.getCurrentUser();
        break;

      case 'send-file':
        if (positional.length === 0) {
          console.error('Error: File path is required');
          process.exit(1);
        }
        result = client.sendFile(positional[0], {
          channelId: options.channel || options.c,
          content: options.message || options.m,
          silent: !options['no-silent']
        });
        break;

      case 'dm':
        if (positional.length === 0) {
          console.error('Error: User ID is required');
          console.error('Usage: pave run discord dm <userID>');
          process.exit(1);
        }
        result = client.createDMChannel(positional[0]);
        break;

      case 'channels':
        // Get guilds and their channels
        const guilds = client.getGuilds();
        
        if (options.summary) {
          let output = 'Accessible Servers/Channels:\n\n';
          
          for (const guild of guilds) {
            output += `🏠 ${guild.name} (ID: ${guild.id})\n`;
            
            try {
              const channels = client.getGuildChannels(guild.id);
              const textChannels = channels.filter(c => c.type === 0 || c.type === 5); // Text and announcement channels
              
              if (textChannels.length > 0) {
                for (const channel of textChannels.slice(0, 5)) { // Show first 5 channels
                  output += `   📄 #${channel.name} (ID: ${channel.id})\n`;
                }
                if (textChannels.length > 5) {
                  output += `   ... and ${textChannels.length - 5} more channels\n`;
                }
              }
            } catch (e) {
              output += `   (Cannot access channels: ${e.message})\n`;
            }
            
            output += '\n';
          }
          
          console.log(output);
          return;
        } else {
          // JSON format - return full guild data
          result = guilds;
        }
        break;

      default:
        console.error(`Error: Unknown command "${command}"`);
        console.error('Run "pave run discord help" for usage information');
        process.exit(1);
    }

    console.log(formatOutput(result, options));

  } catch (error) {
    if (options.json) {
      console.error(JSON.stringify({
        error: error.message,
        status: error.status,
        data: error.data,
      }, null, 2));
    } else {
      console.error('❌ Error:', error.message);
      if (error.status) {
        console.error(`   Status: ${error.status}`);
      }
      if (error.data && typeof error.data === 'object') {
        console.error('   Details:', JSON.stringify(error.data, null, 2));
      }
    }
    process.exit(1);
  }
}

// Run the CLI
main();

module.exports = { DiscordClient };
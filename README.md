# Terminal Monitor Extension

Minimal VS Code extension that automatically closes idle terminals.

## Installation

1. Copy this folder to your VS Code extensions directory:
   - Windows: `%USERPROFILE%\.vscode\extensions\terminal-monitor`
   - Mac/Linux: `~/.vscode/extensions/terminal-monitor`

2. Reload VS Code

3. The monitor starts automatically on startup

## Usage

**Commands:**
- `Terminal Monitor: Start` - Start monitoring
- `Terminal Monitor: Stop` - Stop monitoring

**Configuration:**
- Idle timeout: 60 seconds (edit `IDLE_TIMEOUT` in extension.js)
- Check interval: 10 seconds (edit `CHECK_INTERVAL` in extension.js)
- Protected terminals: PowerShell Extension, Monitor Idle Terminals (edit `protectedNames` in extension.js)

## How It Works

- Monitors all terminal windows every 10 seconds
- Tracks last activity time for each terminal
- Closes terminals that have been idle for > 60 seconds
- Protects specific terminals from being closed
- Starts automatically when VS Code opens

## Development

To modify:
1. Edit `extension.js` to change behavior
2. Reload VS Code window (`Ctrl+R` in Extension Development Host)

To package:
```bash
npm install -g @vscode/vsce
vsce package
```

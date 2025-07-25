# Claude Code Task Completion Sound Hook

This directory contains hooks that play sounds and show notifications when Claude Code completes tasks or encounters errors.

## Available Hooks

1. **`play-completion-sound.sh`** - Basic completion sound (beeps)
2. **`play-completion-sound-enhanced.sh`** - Enhanced version with melody and desktop notifications
3. **`play-error-sound.sh`** - Error sound for when tasks fail

## Setup Instructions

1. **Configure Claude Code Settings**
   
   Add the following to your Claude Code settings file (usually located at `~/.config/claude-code/settings.json` or similar):

   ```json
   {
     "hooks": {
       "after-task-complete": "/home/happy/projects/hpms/hooks/play-completion-sound.sh"
     }
   }
   ```

   Or if using environment variables:
   ```bash
   export CLAUDE_CODE_AFTER_TASK_COMPLETE_HOOK="/home/happy/projects/hpms/hooks/play-completion-sound.sh"
   ```

2. **Test the Hook**
   
   You can test if the sound works on your system by running:
   ```bash
   ./play-completion-sound.sh
   ```

## Supported Platforms

The hook automatically detects your operating system and uses the appropriate method:

- **Linux**: Uses PulseAudio (`paplay`) or ALSA (`aplay`)
- **macOS**: Uses `afplay` or `osascript`
- **Windows** (Git Bash/WSL): Uses PowerShell beep
- **Fallback**: Terminal bell sound (`\a`)

## Customization

You can modify the `play-completion-sound.sh` script to:
- Use different sound files
- Change the notification method
- Add visual notifications
- Send desktop notifications

## Example: Desktop Notification

To add desktop notifications alongside the sound, you can modify the script to include:

```bash
# Linux
notify-send "Claude Code" "Task completed!" 2>/dev/null

# macOS
osascript -e 'display notification "Task completed!" with title "Claude Code"' 2>/dev/null

# Windows
powershell.exe -c "New-BurntToastNotification -Text 'Claude Code','Task completed!'" 2>/dev/null
```

## Logging

The hook logs all completions to `~/.claude-code-completions.log` for tracking purposes.

## Troubleshooting

If the sound doesn't play:
1. Check if your system has audio enabled
2. Verify the script has execute permissions: `chmod +x play-completion-sound.sh`
3. Test system sounds manually
4. Check the log file for any errors
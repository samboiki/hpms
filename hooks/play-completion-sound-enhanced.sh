#!/usr/bin/env bash

# Enhanced Claude Code hook with multiple notification methods
# This version includes visual notifications and custom sounds

# Detect the operating system
OS="$(uname -s)"

# Function to send desktop notification
send_notification() {
    local title="$1"
    local message="$2"
    
    if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
        # WSL: Use Windows toast notification
        powershell.exe -Command "
            \$notify = New-Object -ComObject Wscript.Shell
            \$notify.Popup('$message', 10, '$title', 64) | Out-Null
        " 2>/dev/null || true
    elif command -v notify-send &> /dev/null; then
        # Linux: Use notify-send
        notify-send "$title" "$message" --icon=dialog-information 2>/dev/null || true
    elif [[ "$OS" == "Darwin" ]]; then
        # macOS: Use osascript
        osascript -e "display notification \"$message\" with title \"$title\"" 2>/dev/null || true
    fi
}

# Play completion sound
case "${OS}" in
    Linux*)
        if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
            # WSL: Play a custom melody using PowerShell
            powershell.exe -Command "
                # Play a success melody
                [console]::beep(523,100)  # C
                [console]::beep(659,100)  # E
                [console]::beep(784,100)  # G
                [console]::beep(1047,200) # High C
                
                # Alternative: Use Windows system sounds
                Add-Type -AssemblyName System.Media
                \$player = New-Object System.Media.SoundPlayer
                \$player.SoundLocation = 'C:\Windows\Media\chimes.wav'
                \$player.Play()
            " 2>/dev/null || echo -e "\a"
        else
            # Native Linux
            if command -v paplay &> /dev/null; then
                paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || echo -e "\a"
            else
                echo -e "\a"
            fi
        fi
        ;;
    Darwin*)
        # macOS: Play system sound
        afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || \
        osascript -e 'beep' 2>/dev/null || \
        echo -e "\a"
        ;;
    *)
        echo -e "\a"
        ;;
esac

# Send desktop notification
send_notification "Claude Code" "✅ Task completed successfully!"

# Log the completion with timestamp
log_file="$HOME/.claude-code-completions.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Task completed - Notification sent" >> "$log_file"

# Optional: Show a brief summary in terminal
echo "🎉 Task completed! Sound and notification sent."
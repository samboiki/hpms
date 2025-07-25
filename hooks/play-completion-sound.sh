#!/usr/bin/env bash

# Claude Code hook to play a sound when a task is completed
# This hook can be configured in Claude Code settings

# Detect the operating system
OS="$(uname -s)"

case "${OS}" in
    Linux*)
        # Check if running in WSL
        if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
            # WSL: Use Windows PowerShell to play sound
            if command -v powershell.exe &> /dev/null; then
                powershell.exe -c "[console]::beep(800,200); [console]::beep(1000,200); [console]::beep(1200,200)" 2>/dev/null || \
                powershell.exe -c "[System.Media.SystemSounds]::Asterisk.Play()" 2>/dev/null || \
                echo -e "\a"
            elif command -v cmd.exe &> /dev/null; then
                cmd.exe /c "echo ^G" 2>/dev/null || echo -e "\a"
            else
                echo -e "\a"
            fi
        else
            # Native Linux: Use paplay (PulseAudio) or aplay (ALSA)
            if command -v paplay &> /dev/null; then
                # Play a system sound using PulseAudio
                paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || \
                paplay /usr/share/sounds/ubuntu/stereo/dialog-information.ogg 2>/dev/null || \
                paplay /usr/share/sounds/gnome/default/alerts/glass.ogg 2>/dev/null || \
                echo -e "\a"  # Fallback to terminal bell
            elif command -v aplay &> /dev/null; then
                # Play a system sound using ALSA
                aplay /usr/share/sounds/alsa/Front_Center.wav 2>/dev/null || \
                echo -e "\a"  # Fallback to terminal bell
            else
                # Fallback to terminal bell
                echo -e "\a"
            fi
        fi
        ;;
    Darwin*)
        # macOS: Use afplay or osascript
        if command -v afplay &> /dev/null; then
            # Play a system sound
            afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || \
            afplay /System/Library/Sounds/Ping.aiff 2>/dev/null || \
            osascript -e 'beep' 2>/dev/null
        else
            # Use osascript to play a sound
            osascript -e 'beep' 2>/dev/null || echo -e "\a"
        fi
        ;;
    CYGWIN*|MINGW*|MSYS*)
        # Windows (Git Bash, WSL): Use PowerShell
        powershell.exe -c "[console]::beep(1000,300)" 2>/dev/null || \
        cmd.exe /c "echo ^G" 2>/dev/null || \
        echo -e "\a"
        ;;
    *)
        # Unknown OS: Use terminal bell
        echo -e "\a"
        ;;
esac

# Optional: Log the completion
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Task completed - sound played" >> ~/.claude-code-completions.log
#!/usr/bin/env bash

# Claude Code hook to play an error sound
# This hook can be configured for error events

# Detect the operating system
OS="$(uname -s)"

case "${OS}" in
    Linux*)
        if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
            # WSL: Play error beeps
            powershell.exe -c "[console]::beep(300,200); [console]::beep(250,200); [console]::beep(200,400)" 2>/dev/null || \
            powershell.exe -c "[System.Media.SystemSounds]::Hand.Play()" 2>/dev/null || \
            echo -e "\a\a"
        else
            # Native Linux
            if command -v paplay &> /dev/null; then
                paplay /usr/share/sounds/freedesktop/stereo/dialog-error.oga 2>/dev/null || \
                paplay /usr/share/sounds/gnome/default/alerts/drip.ogg 2>/dev/null || \
                echo -e "\a\a"
            else
                echo -e "\a\a"
            fi
        fi
        ;;
    Darwin*)
        # macOS: Play error sound
        afplay /System/Library/Sounds/Basso.aiff 2>/dev/null || \
        afplay /System/Library/Sounds/Funk.aiff 2>/dev/null || \
        osascript -e 'beep 2' 2>/dev/null || \
        echo -e "\a\a"
        ;;
    *)
        echo -e "\a\a"
        ;;
esac

# Log the error
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Error occurred - sound played" >> ~/.claude-code-errors.log
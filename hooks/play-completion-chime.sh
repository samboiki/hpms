#!/usr/bin/env bash

# Claude Code hook to play a nice chime sound when a task is completed

# Play a nice Windows chime sound
if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
    # Try different Windows system sounds in order of preference
    powershell.exe -c "
        # Try to play nice chime sounds
        try {
            (New-Object Media.SoundPlayer 'C:\Windows\Media\chimes.wav').PlaySync()
        } catch {
            try {
                (New-Object Media.SoundPlayer 'C:\Windows\Media\Windows Notify Calendar.wav').PlaySync()
            } catch {
                try {
                    (New-Object Media.SoundPlayer 'C:\Windows\Media\Windows Ding.wav').PlaySync()
                } catch {
                    try {
                        (New-Object Media.SoundPlayer 'C:\Windows\Media\tada.wav').PlaySync()
                    } catch {
                        # Fallback to beep
                        [console]::beep(1000,300)
                    }
                }
            }
        }
    " 2>/dev/null
fi

# Log the completion
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Task completed - chime played" >> ~/.claude-code-completions.log

# Optional: Show a brief message
echo "✨ Task completed!"
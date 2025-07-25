#!/usr/bin/env bash

# Preview available Windows sounds to choose your favorite

echo "🎵 Windows Sound Preview"
echo "======================="
echo "Press Ctrl+C to stop at any time"
echo ""

sounds=(
    "C:\Windows\Media\chimes.wav:Chimes (gentle)"
    "C:\Windows\Media\Windows Ding.wav:Ding (classic)"
    "C:\Windows\Media\tada.wav:Tada (celebration)"
    "C:\Windows\Media\Windows Notify Calendar.wav:Calendar notification"
    "C:\Windows\Media\Windows Notify.wav:General notification"
    "C:\Windows\Media\Windows Logon.wav:Logon sound"
    "C:\Windows\Media\Windows Unlock.wav:Unlock sound"
    "C:\Windows\Media\Windows Proximity Notification.wav:Proximity notification"
    "C:\Windows\Media\Windows Pop-up Blocked.wav:Pop-up blocked"
    "C:\Windows\Media\Windows Hardware Insert.wav:Hardware insert"
    "C:\Windows\Media\Alarm01.wav:Alarm 1"
    "C:\Windows\Media\Alarm02.wav:Alarm 2"
    "C:\Windows\Media\Alarm03.wav:Alarm 3"
)

for sound_info in "${sounds[@]}"; do
    IFS=':' read -r sound_path description <<< "$sound_info"
    echo "▶️  Playing: $description"
    echo "   File: $sound_path"
    
    powershell.exe -c "
        try {
            (New-Object Media.SoundPlayer '$sound_path').PlaySync()
            Start-Sleep -Milliseconds 500
        } catch {
            Write-Host '   ❌ Sound not found'
        }
    " 2>/dev/null
    
    echo ""
    sleep 1
done

echo "Done! Pick your favorite and update play-completion-chime.sh"
import { useRef, useCallback } from 'react';

// Define different sound types
export type CompletionSoundType = 'success' | 'achievement' | 'notification' | 'subtle';

// Sound URLs - using base64 encoded sounds or external URLs
const SOUND_URLS: Record<CompletionSoundType, string> = {
  // Success sound - cheerful completion
  success: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTcIG2m98OScTgwOUarm7blmFgU7k9n1unEiBC13yO/eizEIHWq+8+OWT',
  
  // Achievement sound - more triumphant
  achievement: 'data:audio/wav;base64,UklGRl4GAABXQVZFZm10IBAAAAABAAEAESsAACJWAAABAAgAZGF0YToGAAB/hIWLjpKTlJSVlZWSkI2HgHx1b2lkX1pWUk9NSUVFREJAQD9AQEFDR0tPVFpgZm1zeYCGjJGWmZycnJualZGLhH12bmdeVEpBOTArJiQjJCYpLTI5QEhRW2VveYONlJudnp6dmJKKgHZsYVVKPjMqIx4bGxwfJCsyOkRPW2dzhI6Xn6CgoJ',
  
  // Notification sound - simple ding
  notification: 'data:audio/wav;base64,UklGRjAGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQABAAgAZGF0YQwGAACEgoB+fHp4dnRycG5sa2poZmVkY2JhYGBgYWJjZGVnaWttb3J0dnt9gIKEhoeJiouMjY6OjY2NjIyLioqJiIiHh4eHh4eIiImKi4yNjo+QkZOUlZaXl5iYmJiXl5aVlJOSkI+NjIqIh4WEgoGAf359fXx8fHx9fX5/gIGChIWHiYqMjY+QkZOUlZaXmJmZmpqampqZ',
  
  // Subtle sound - soft completion
  subtle: 'data:audio/wav;base64,UklGRvAFAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAABAAgAZGF0YcwFAACIiIiIiIiIh4eGhYWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sampoZ2ZlZGNiYWBfX15dXVxcXFxcXVxdXl5fYGFiY2RlZmdpamtsbm9xc3R1d3l6fH5/gYOFhoiKi42Oj5GSlJWWl5iZmZqampqamZmYl5aVlJKRj46MioiGhIKAf318e3p5eHd3dnZ2dnd3eHl6e3x9fn+AgYKDhIWGh4iJiouMjI2Njo6Ojo6Ojo2NjYyLioqJiIeGhYSCgYB/fXt5dnRxbmxpZmNgXltYVVJPTEpHREE/PDs5NzU0MjEwLy4uLi4vMDEyMzU3OTs+QUVJTVFVWV5iZmtwdHh9gYaKjpKWmZyfoaOkpaSko6KgnZqXk4+Lh4J9eHNuaWRfWlVRTEhEPzw4NDAsKCUiIB4dHBscHB0eICIlKCwwNTk9Q0hNUldeY2lud3+Hj5adpKmvsrW3ubq7u7u6ubi2tLKurKikn5uXkYyHgX16dnNwbWtoZmNhX11cXFxcXV5fYWJkZmlrbnFzdnl7foCChIaHiYqLjI2Ojo6Ojo6Ojo2MjIuKiYiGhYOCgH99enl3dHJwbWpoZGBcWFRQTEhEPzo2MzAtKiclIyEgHx4eHh4fICEjJScoKy4xNDg7P0NGS09UWF1iZ21yd3yBhoyRlpufo6epq6ytrq6urq6trKuqqKakoJ6alJCLhYB7dW9pY11YUkxGQj05NTEvLS0tLzE1OT5DSE5VXGJpb3V7gIaNkpebnqGjpKalo6OioJ6bl5KOiYN9d3Fsa2lnaGdpamxucHN2eX2Ag4aJjI6RkpOUlJSUk5KSkZCPjoyKh4SBfXp3c3Btamt',
};

interface UseTaskCompletionSoundOptions {
  enabled?: boolean;
  volume?: number;
  soundType?: CompletionSoundType;
}

export const useTaskCompletionSound = (options: UseTaskCompletionSoundOptions = {}) => {
  const {
    enabled = true,
    volume = 0.5,
    soundType = 'success'
  } = options;

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playCompletionSound = useCallback(async (customSoundType?: CompletionSoundType) => {
    if (!enabled) return;

    try {
      const selectedSound = customSoundType || soundType;
      const soundUrl = SOUND_URLS[selectedSound];

      // Create a new audio instance for each play to avoid conflicts
      const audio = new Audio(soundUrl);
      audio.volume = Math.max(0, Math.min(1, volume));
      
      // Clean up after playing
      audio.addEventListener('ended', () => {
        audio.remove();
      });

      // Handle errors silently
      audio.addEventListener('error', (e) => {
        console.warn('Failed to play completion sound:', e);
      });

      await audio.play();
    } catch (error) {
      console.warn('Error playing completion sound:', error);
    }
  }, [enabled, volume, soundType]);

  const preloadSound = useCallback((type: CompletionSoundType = soundType) => {
    if (!enabled) return;

    try {
      const audio = new Audio(SOUND_URLS[type]);
      audio.volume = 0;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {
        // Silently fail if autoplay is blocked
      });
    } catch (error) {
      console.warn('Error preloading sound:', error);
    }
  }, [enabled, soundType]);

  return {
    playCompletionSound,
    preloadSound,
  };
};

// Hook for playing sounds on specific events
export const useTaskEventSounds = () => {
  const { playCompletionSound } = useTaskCompletionSound({ volume: 0.3 });

  const playTaskCompleted = useCallback(() => {
    playCompletionSound('success');
  }, [playCompletionSound]);

  const playMilestoneReached = useCallback(() => {
    playCompletionSound('achievement');
  }, [playCompletionSound]);

  const playNotification = useCallback(() => {
    playCompletionSound('notification');
  }, [playCompletionSound]);

  const playSubtleComplete = useCallback(() => {
    playCompletionSound('subtle');
  }, [playCompletionSound]);

  return {
    playTaskCompleted,
    playMilestoneReached,
    playNotification,
    playSubtleComplete,
  };
};
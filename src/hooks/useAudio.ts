import { useEffect, useCallback, useState } from 'react';
import { audio } from '@/lib/audio';
import type { SfxName, AmbienceName } from '@/lib/audio';

export type { SfxName, AmbienceName };

export function useAudio() {
  const [isMuted, setIsMuted] = useState(() => audio.getMuted());

  // Initialize audio on mount
  useEffect(() => {
    audio.preload();
  }, []);

  const playSfx = useCallback((name: SfxName) => {
    audio.play(name);
  }, []);

  const playHover = useCallback(() => {
    audio.play('ui_hover');
  }, []);

  const playAmbience = useCallback((depth: number) => {
    audio.playAmbience(depth);
  }, []);

  const toggleMute = useCallback(() => {
    audio.toggleMute();
    setIsMuted(audio.getMuted());
  }, []);

  return { playSfx, playHover, playAmbience, isMuted, toggleMute };
}

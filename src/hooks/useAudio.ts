import { useRef, useCallback, useEffect, useState } from 'react';
import { Howl } from 'howler';

// NOTE: Place sound files (.mp3 or .wav) in the public/sounds/ folder matching these names:
// - ui_click.mp3 (or .wav)
// - ui_hover.mp3 (or .wav)
// - step.mp3 (or .wav)
// - gold.mp3 (or .wav)
// - hit.mp3 (or .wav)
// - rare_loot.mp3 (or .wav)
// - legendary_loot.mp3 (or .wav)
// - ambience_shallows.mp3 (or .wav)

export type SfxName = 'ui_click' | 'ui_hover' | 'step' | 'gold' | 'hit' | 'rare_loot' | 'legendary_loot';
type AmbienceName = 'ambience_shallows';

export function useAudio() {
  // Load mute state from localStorage
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('audio_muted');
      return stored === 'true';
    }
    return false;
  });

  const soundsRef = useRef<Record<SfxName, Howl | null>>({
    ui_click: null,
    ui_hover: null,
    step: null,
    gold: null,
    hit: null,
    rare_loot: null,
    legendary_loot: null,
  });

  const ambienceRef = useRef<Record<AmbienceName, Howl | null>>({
    ambience_shallows: null,
  });

  const currentAmbienceRef = useRef<Howl | null>(null);
  const failedSoundsRef = useRef<Set<SfxName | AmbienceName>>(new Set());
  const audioUnlockedRef = useRef(false);

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      
      // Resume Howler's audio context if it exists
      if (typeof window !== 'undefined' && (window as any).Howl) {
        const ctx = (window as any).Howl?.ctx;
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {
            // Silently fail if resume fails
          });
        }
      }
    };

    // Listen for any user interaction
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, unlockAudio, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, unlockAudio);
      });
    };
  }, []);

  // Initialize sounds
  useEffect(() => {
    // Initialize SFX sounds with silent error handling
    soundsRef.current.ui_click = new Howl({
      src: ['/sounds/ui_click.mp3', '/sounds/ui_click.wav'],
      volume: 0.5,
      preload: false, // Don't preload to avoid AudioContext issues
      onloaderror: (id, error) => {
        // Silently mark as failed - don't spam console
        failedSoundsRef.current.add('ui_click');
        soundsRef.current.ui_click = null;
      },
    });

    soundsRef.current.ui_hover = new Howl({
      src: ['/sounds/ui_hover.mp3', '/sounds/ui_hover.wav'],
      volume: 0.3,
      preload: false,
      onloaderror: (id, error) => {
        failedSoundsRef.current.add('ui_hover');
        soundsRef.current.ui_hover = null;
      },
    });

    soundsRef.current.step = new Howl({
      src: ['/sounds/step.mp3', '/sounds/step.wav'],
      volume: 0.4,
      preload: false,
      onloaderror: (id, error) => {
        failedSoundsRef.current.add('step');
        soundsRef.current.step = null;
      },
    });

    soundsRef.current.gold = new Howl({
      src: ['/sounds/gold.mp3', '/sounds/gold.wav'],
      volume: 0.5,
      preload: false,
      onloaderror: (id, error) => {
        failedSoundsRef.current.add('gold');
        soundsRef.current.gold = null;
      },
    });

    soundsRef.current.hit = new Howl({
      src: ['/sounds/hit.mp3', '/sounds/hit.wav'],
      volume: 0.6,
      preload: false,
      onloaderror: (id, error) => {
        failedSoundsRef.current.add('hit');
        soundsRef.current.hit = null;
      },
    });

    soundsRef.current.rare_loot = new Howl({
      src: ['/sounds/rare_loot.mp3', '/sounds/rare_loot.wav'],
      volume: 0.6,
      preload: false,
      onloaderror: (id, error) => {
        // Silently mark as failed - don't spam console
        failedSoundsRef.current.add('rare_loot');
        soundsRef.current.rare_loot = null;
      },
    });

    soundsRef.current.legendary_loot = new Howl({
      src: ['/sounds/legendary_loot.mp3', '/sounds/legendary_loot.wav'],
      volume: 0.7,
      preload: false,
      onloaderror: (id, error) => {
        failedSoundsRef.current.add('legendary_loot');
        soundsRef.current.legendary_loot = null;
      },
    });

    // Initialize ambience sounds
    ambienceRef.current.ambience_shallows = new Howl({
      src: ['/sounds/ambience_shallows.mp3', '/sounds/ambience_shallows.wav'],
      volume: 0.3,
      loop: true,
      preload: false,
      onloaderror: (id, error) => {
        failedSoundsRef.current.add('ambience_shallows');
        ambienceRef.current.ambience_shallows = null;
      },
    });

    // Cleanup on unmount
    return () => {
      Object.values(soundsRef.current).forEach((sound) => {
        if (sound) {
          sound.unload();
        }
      });
      Object.values(ambienceRef.current).forEach((sound) => {
        if (sound) {
          sound.unload();
        }
      });
      if (currentAmbienceRef.current) {
        currentAmbienceRef.current.unload();
      }
    };
  }, []);

  const playSfx = useCallback((name: SfxName) => {
    // Don't play if muted
    if (isMuted) return;
    
    // Don't try to play if we know it failed to load
    if (failedSoundsRef.current.has(name)) return;
    
    const sound = soundsRef.current[name];
    if (!sound) {
      return; // Silently fail if sound not initialized
    }

    try {
      // Unlock audio on first play attempt
      if (!audioUnlockedRef.current) {
        audioUnlockedRef.current = true;
        // Resume Howler's audio context if it exists
        if (typeof window !== 'undefined' && (window as any).Howl) {
          const ctx = (window as any).Howl?.ctx;
          if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {
              // Silently fail if resume fails
            });
          }
        }
      }

      // Check if sound is loaded
      const state = sound.state();
      if (state === 'unloaded') {
        sound.load();
        // Wait for load then play
        sound.once('load', () => {
          if (isMuted) return; // Check mute again after load
          const pitch = 0.9 + Math.random() * 0.2;
          sound.rate(pitch);
          sound.play();
        });
        sound.once('loaderror', () => {
          // Silently mark as failed
          failedSoundsRef.current.add(name);
          soundsRef.current[name] = null;
        });
        return;
      }

      // Random pitch variation between 0.9 and 1.1 for realism
      const pitch = 0.9 + Math.random() * 0.2;
      sound.rate(pitch);
      sound.play();
    } catch (error) {
      // Silently fail
    }
  }, [isMuted]);

  const playAmbience = useCallback((depth: number) => {
    // Don't play if muted
    if (isMuted) {
      // Stop any playing ambience
      if (currentAmbienceRef.current && currentAmbienceRef.current.playing()) {
        currentAmbienceRef.current.stop();
        currentAmbienceRef.current = null;
      }
      return;
    }
    
    // Don't play ambience until audio is unlocked
    if (!audioUnlockedRef.current) {
      return;
    }
    
    // Determine which ambience to play based on depth
    let targetAmbience: AmbienceName = 'ambience_shallows';
    
    // For now, we only have shallows ambience
    // You can add more ambience tracks later (e.g., ambience_deep, ambience_abyss)
    // and switch based on depth thresholds
    
    const targetSound = ambienceRef.current[targetAmbience];
    if (!targetSound || failedSoundsRef.current.has(targetAmbience)) return;

    // If the same ambience is already playing, don't restart
    if (currentAmbienceRef.current === targetSound && targetSound.playing()) {
      return;
    }

    // Ensure sound is loaded before playing
    const state = targetSound.state();
    if (state === 'unloaded') {
      targetSound.load();
      // Wait for load then play
      targetSound.once('load', () => {
        if (isMuted) return; // Check mute again after load
        
        // Fade out current ambience if playing
        if (currentAmbienceRef.current && currentAmbienceRef.current.playing()) {
          currentAmbienceRef.current.fade(
            currentAmbienceRef.current.volume(),
            0,
            1000,
          );
          currentAmbienceRef.current.once('fade', () => {
            if (currentAmbienceRef.current) {
              currentAmbienceRef.current.stop();
            }
          });
        }

        // Fade in new ambience
        targetSound.volume(0);
        targetSound.play();
        targetSound.fade(0, 0.3, 1000);
        currentAmbienceRef.current = targetSound;
      });
      targetSound.once('loaderror', () => {
        // Silently mark as failed
        failedSoundsRef.current.add(targetAmbience);
        ambienceRef.current[targetAmbience] = null;
      });
      return;
    }

    // Fade out current ambience if playing
    if (currentAmbienceRef.current && currentAmbienceRef.current.playing()) {
      currentAmbienceRef.current.fade(
        currentAmbienceRef.current.volume(),
        0,
        1000,
      );
      currentAmbienceRef.current.once('fade', () => {
        if (currentAmbienceRef.current) {
          currentAmbienceRef.current.stop();
        }
      });
    }

    // Fade in new ambience
    targetSound.volume(0);
    targetSound.play();
    targetSound.fade(0, 0.3, 1000);
    currentAmbienceRef.current = targetSound;
  }, [isMuted]);

  const playHover = useCallback(() => {
    playSfx('ui_hover');
  }, [playSfx]);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('audio_muted', String(newMuted));
    }
    
    // Stop ambience if muting
    if (newMuted && currentAmbienceRef.current && currentAmbienceRef.current.playing()) {
      currentAmbienceRef.current.stop();
      currentAmbienceRef.current = null;
    }
    
    // Resume ambience if unmuting (will be triggered by depth change)
  }, [isMuted]);

  return { playSfx, playHover, playAmbience, isMuted, toggleMute };
}


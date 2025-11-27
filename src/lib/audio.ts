import { Howl } from 'howler';

// Sound configuration - paths to audio files
const SOUNDS = {
  ui_click: ['/sounds/ui_click.mp3', '/sounds/ui_click.wav'],
  ui_hover: ['/sounds/ui_hover.mp3', '/sounds/ui_hover.wav'],
  step: ['/sounds/step.mp3', '/sounds/step.wav'],
  gold: ['/sounds/gold.mp3', '/sounds/gold.wav'],
  hit: ['/sounds/hit.mp3', '/sounds/hit.wav'],
  rare_loot: ['/sounds/rare_loot.mp3', '/sounds/rare_loot.wav'],
  legendary_loot: ['/sounds/legendary_loot.mp3', '/sounds/legendary_loot.wav'],
  ambience_shallows: ['/sounds/ambience_shallows.mp3', '/sounds/ambience_shallows.wav'],
} as const;

export type SoundKey = keyof typeof SOUNDS;
export type SfxName = 'ui_click' | 'ui_hover' | 'step' | 'gold' | 'hit' | 'rare_loot' | 'legendary_loot';
export type AmbienceName = 'ambience_shallows';

// Volume configuration
const VOLUMES: Record<SoundKey, number> = {
  ui_click: 0.5,
  ui_hover: 0.3,
  step: 0.4,
  gold: 0.5,
  hit: 0.6,
  rare_loot: 0.6,
  legendary_loot: 0.7,
  ambience_shallows: 0.3,
};

class SoundManager {
  private sounds: Map<SoundKey, Howl> = new Map();
  private lastPlayed: Map<SoundKey, number> = new Map();
  private rateLimitMs = 50; // Prevent same sound from playing more than once every 50ms
  private isMuted = false;
  private audioUnlocked = false;
  private currentAmbience: Howl | null = null;
  private failedSounds: Set<SoundKey> = new Set();

  constructor() {
    // Load mute state from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('audio_muted');
      this.isMuted = stored === 'true';
    }
  }

  /**
   * Preload all sounds
   */
  preload(): void {
    if (typeof window === 'undefined') return;

    Object.entries(SOUNDS).forEach(([key, src]) => {
      const soundKey = key as SoundKey;
      
      // Skip if already loaded or failed
      if (this.sounds.has(soundKey) || this.failedSounds.has(soundKey)) {
        return;
      }

      const isAmbience = soundKey === 'ambience_shallows';
      const howl = new Howl({
        src: [...src], // Spread to convert readonly array to mutable array
        volume: VOLUMES[soundKey],
        preload: true,
        loop: isAmbience,
        onloaderror: () => {
          // Silently mark as failed
          this.failedSounds.add(soundKey);
          this.sounds.delete(soundKey);
        },
      });

      this.sounds.set(soundKey, howl);
    });
  }

  /**
   * Unlock audio context (required for browser autoplay policy)
   */
  unlock(): void {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;

    // Resume Howler's audio context if it exists
    if (typeof window !== 'undefined' && (window as any).Howl) {
      const ctx = (window as any).Howl?.ctx;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          // Silently fail if resume fails
        });
      }
    }

    // Play a silent sound to unlock audio context
    try {
      const silentSound = new Howl({
        src: ['data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='],
        volume: 0,
      });
      silentSound.play();
      silentSound.once('play', () => {
        silentSound.unload();
      });
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Play a sound effect
   */
  play(key: SfxName): void {
    if (this.isMuted) return;
    if (this.failedSounds.has(key)) return;

    // Rate limiting: prevent same sound from playing too frequently
    const now = Date.now();
    const lastPlayed = this.lastPlayed.get(key) || 0;
    if (now - lastPlayed < this.rateLimitMs) {
      return;
    }
    this.lastPlayed.set(key, now);

    const sound = this.sounds.get(key);
    if (!sound) {
      // Try to load it on-demand if not preloaded
      this.loadSound(key);
      return;
    }

    // Unlock audio on first play attempt
    if (!this.audioUnlocked) {
      this.unlock();
    }

    try {
      const state = sound.state();
      if (state === 'unloaded') {
        sound.load();
        sound.once('load', () => {
          if (this.isMuted) return;
          const pitch = 0.9 + Math.random() * 0.2;
          sound.rate(pitch);
          sound.play();
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
  }

  /**
   * Play ambience based on depth
   */
  playAmbience(depth: number): void {
    if (this.isMuted) {
      // Stop any playing ambience
      if (this.currentAmbience && this.currentAmbience.playing()) {
        this.currentAmbience.stop();
        this.currentAmbience = null;
      }
      return;
    }

    // Don't play ambience until audio is unlocked
    if (!this.audioUnlocked) {
      return;
    }

    // For now, we only have shallows ambience
    // You can add more ambience tracks later (e.g., ambience_deep, ambience_abyss)
    // and switch based on depth thresholds
    const targetAmbience: AmbienceName = 'ambience_shallows';
    const targetSound = this.sounds.get(targetAmbience);

    if (!targetSound || this.failedSounds.has(targetAmbience)) return;

    // If the same ambience is already playing, don't restart
    if (this.currentAmbience === targetSound && targetSound.playing()) {
      return;
    }

    // Ensure sound is loaded before playing
    const state = targetSound.state();
    if (state === 'unloaded') {
      targetSound.load();
      targetSound.once('load', () => {
        if (this.isMuted) return;

        // Fade out current ambience if playing
        if (this.currentAmbience && this.currentAmbience.playing()) {
          this.currentAmbience.fade(
            this.currentAmbience.volume(),
            0,
            1000,
          );
          this.currentAmbience.once('fade', () => {
            if (this.currentAmbience) {
              this.currentAmbience.stop();
            }
          });
        }

        // Fade in new ambience
        targetSound.volume(0);
        targetSound.play();
        targetSound.fade(0, VOLUMES[targetAmbience], 1000);
        this.currentAmbience = targetSound;
      });
      return;
    }

    // Fade out current ambience if playing
    if (this.currentAmbience && this.currentAmbience.playing()) {
      this.currentAmbience.fade(
        this.currentAmbience.volume(),
        0,
        1000,
      );
      this.currentAmbience.once('fade', () => {
        if (this.currentAmbience) {
          this.currentAmbience.stop();
        }
      });
    }

    // Fade in new ambience
    targetSound.volume(0);
    targetSound.play();
    targetSound.fade(0, VOLUMES[targetAmbience], 1000);
    this.currentAmbience = targetSound;
  }

  /**
   * Load a sound on-demand
   */
  private loadSound(key: SoundKey): void {
    if (this.sounds.has(key) || this.failedSounds.has(key)) {
      return;
    }

    const src = SOUNDS[key];
    const isAmbience = key === 'ambience_shallows';
    const howl = new Howl({
      src: [...src], // Spread to convert readonly array to mutable array
      volume: VOLUMES[key],
      preload: false,
      loop: isAmbience,
      onloaderror: () => {
        this.failedSounds.add(key);
        this.sounds.delete(key);
      },
    });

    this.sounds.set(key, howl);
  }

  /**
   * Toggle mute state
   */
  toggleMute(): void {
    this.isMuted = !this.isMuted;

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('audio_muted', String(this.isMuted));
    }

    // Stop ambience if muting
    if (this.isMuted && this.currentAmbience && this.currentAmbience.playing()) {
      this.currentAmbience.stop();
      this.currentAmbience = null;
    }
  }

  /**
   * Get mute state
   */
  getMuted(): boolean {
    return this.isMuted;
  }
}

// Export singleton instance
export const audio = new SoundManager();


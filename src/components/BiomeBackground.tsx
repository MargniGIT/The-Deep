'use client';

import { motion } from 'framer-motion';

interface BiomeBackgroundProps {
  depth: number;
}

export default function BiomeBackground({ depth }: BiomeBackgroundProps) {
  // Create array of ~15 particles
  const particles = Array.from({ length: 15 }, (_, i) => i);

  // Determine color and animation type based on depth ranges
  let color: string;
  let animationType: 'float' | 'rise' | 'pulse' | 'fall';

  if (depth < 500) {
    // Shallows: Zinc/Float
    color = 'bg-zinc-400';
    animationType = 'float';
  } else if (depth < 1500) {
    // Moss: Emerald/Rise
    color = 'bg-emerald-400';
    animationType = 'rise';
  } else if (depth < 3000) {
    // Crystal: Violet/Pulse
    color = 'bg-violet-400';
    animationType = 'pulse';
  } else {
    // Void: Red/Fall
    color = 'bg-red-400';
    animationType = 'fall';
  }

  // Animation variants based on type
  const getAnimation = (index: number) => {
    const randomLeft = Math.random() * 100; // 0-100% for left position
    const randomSize = 2 + Math.random() * 2; // 2px to 4px
    const randomDuration = 5 + Math.random() * 5; // 5s to 10s
    const randomDelay = Math.random() * 2; // 0-2s delay for variety
    const randomTop = Math.random() * 100; // 0-100% for starting top position

    switch (animationType) {
      case 'float':
        return {
          initial: { 
            left: `${randomLeft}%`, 
            top: `${randomTop}%`,
            opacity: 0.2,
            scale: 1
          },
          animate: {
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [0.2, 0.3, 0.2],
            transition: {
              duration: randomDuration,
              repeat: Infinity,
              ease: 'easeInOut' as const,
              delay: randomDelay
            }
          }
        };
      case 'rise':
        return {
          initial: { 
            left: `${randomLeft}%`, 
            top: '100%',
            opacity: 0.2
          },
          animate: {
            top: '-10%',
            x: Math.random() * 40 - 20,
            opacity: [0.2, 0.3, 0.2],
            transition: {
              duration: randomDuration,
              repeat: Infinity,
              ease: 'linear' as const,
              delay: randomDelay
            }
          }
        };
      case 'pulse':
        return {
          initial: { 
            left: `${randomLeft}%`, 
            top: `${randomTop}%`,
            opacity: 0.2,
            scale: 1
          },
          animate: {
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.4, 0.2],
            transition: {
              duration: randomDuration,
              repeat: Infinity,
              ease: 'easeInOut' as const,
              delay: randomDelay
            }
          }
        };
      case 'fall':
        return {
          initial: { 
            left: `${randomLeft}%`, 
            top: '-10%',
            opacity: 0.2
          },
          animate: {
            top: '100%',
            x: Math.random() * 40 - 20,
            opacity: [0.2, 0.3, 0.2],
            transition: {
              duration: randomDuration,
              repeat: Infinity,
              ease: 'linear' as const,
              delay: randomDelay
            }
          }
        };
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((particle) => {
        const randomSize = 2 + Math.random() * 2; // 2px to 4px
        const animation = getAnimation(particle);
        
        return (
          <motion.div
            key={particle}
            className={`${color} rounded-full`}
            style={{
              width: `${randomSize}px`,
              height: `${randomSize}px`,
              position: 'absolute',
            }}
            initial={animation.initial}
            animate={animation.animate}
          />
        );
      })}
    </div>
  );
}


import { motion } from 'framer-motion';

interface SakuraNameplateProps {
  name: string;
}

export default function SakuraNameplate({ name }: SakuraNameplateProps) {
  // Create an array of 8 particles (ids 0-7)
  const particles = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="relative inline-block overflow-visible">
      {/* The Text */}
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-rose-400 font-black tracking-widest">
        {name}
      </span>

      {/* The Particles */}
      {particles.map((id) => {
        const randomDuration = 2 + Math.random();
        const randomDelay = Math.random() * 2;
        return (
          <motion.div
            key={id}
            className="absolute top-0 w-2 h-2 bg-pink-300/80 rounded-tl-lg rounded-br-lg pointer-events-none"
            initial={{ y: -10, opacity: 0, rotate: 0 }}
            animate={{
              y: 40,
              opacity: [0, 1, 0],
              rotate: 360,
              x: [0, 10, -10, 0]
            }}
            transition={{
              repeat: Infinity,
              duration: randomDuration,
              delay: randomDelay
            }}
            style={{
              left: `${(id / particles.length) * 100}%`
            }}
          />
        );
      })}
    </div>
  );
}


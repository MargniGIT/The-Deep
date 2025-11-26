'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface AchievementNotification {
  title: string;
  icon?: string;
  description: string;
}

interface AchievementToastProps {
  notification: AchievementNotification | null;
}

export default function AchievementToast({ notification }: AchievementToastProps) {
  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 20, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-1/2 transform -translate-x-1/2 z-[9999] pointer-events-none"
        >
          <div className="bg-zinc-900 border-2 border-yellow-500/80 rounded-lg shadow-2xl shadow-yellow-500/50 p-4 min-w-[300px] max-w-[400px] backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Trophy className="w-8 h-8 text-yellow-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-yellow-400 font-bold text-lg mb-1">
                  {notification.title}
                </h3>
                <p className="text-zinc-300 text-sm">
                  {notification.description}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


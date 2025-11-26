import { Scroll, Terminal } from 'lucide-react';

interface GameLogProps {
  logs: string[]; // We renamed this from 'entries' to 'logs' to match page.tsx
}

export default function GameLog({ logs = [] }: GameLogProps) {
  // SAFETY CHECK: The '= []' above defaults it to empty array if undefined.
  // We also check Array.isArray just to be bulletproof.
  const safeLogs = Array.isArray(logs) ? logs : [];

  return (
    <div className="absolute inset-0 flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-zinc-500 mb-2 uppercase text-xs font-bold tracking-widest opacity-50">
        <Terminal size={14} />
        <span>System Log</span>
      </div>

      {/* The Scrollable Log Area */}
      <div className="flex-1 overflow-y-auto font-mono text-sm space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {safeLogs.length === 0 ? (
          <div className="text-zinc-700 italic">No activity recorded...</div>
        ) : (
          safeLogs.map((entry, i) => (
            <div key={i} className="border-l-2 border-zinc-800 pl-3 py-1 text-zinc-300 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Highlight special words for flavor */}
              {entry.includes('found') ? (
                <span className="text-yellow-500">{entry}</span>
              ) : entry.includes('DIED') || entry.includes('damage') ? (
                <span className="text-red-400">{entry}</span>
              ) : (
                <span>{entry}</span>
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Bottom fade effect */}
      <div className="h-4 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none absolute bottom-0 left-0 right-0" />
    </div>
  );
}
import { Terminal } from 'lucide-react';

interface GameLogProps {
  logs: string[];
}

export default function GameLog({ logs = [] }: GameLogProps) {
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
          safeLogs.map((entry, i) => {
            // Determine if this is atmosphere/scary text (default case = atmosphere)
            const isAtmosphere = !entry.includes('You found') &&
              !entry.includes('vein') &&
              !entry.includes('Defeated') &&
              !entry.includes('DIED') &&
              !entry.includes('damage') &&
              !entry.includes('LEVEL UP') &&
              !entry.includes('[LEGENDARY]') &&
              !entry.includes('[SET]') &&
              !entry.includes('[RARE]') &&
              !entry.includes('[UNCOMMON]') &&
              !entry.includes('[JUNK]') &&
              !entry.includes('[GHOST]');

            // Parse rarity tags and apply styling
            const parseRarityTags = (text: string) => {
              const parts: Array<{ text: string; className?: string }> = [];
              let remaining = text;
              let lastIndex = 0;

              // Match rarity tags and ghost tag
              const tagPattern = /\[(LEGENDARY|SET|RARE|UNCOMMON|JUNK|GHOST)\]/g;
              let match;

              while ((match = tagPattern.exec(text)) !== null) {
                // Add text before the tag
                if (match.index > lastIndex) {
                  parts.push({ text: text.substring(lastIndex, match.index) });
                }

                // Add the tag with appropriate styling
                const tag = match[1];
                let className = '';
                switch (tag) {
                  case 'LEGENDARY':
                    className = 'text-legendary';
                    break;
                  case 'SET':
                    className = 'text-set';
                    break;
                  case 'RARE':
                    className = 'text-blue-400 font-bold';
                    break;
                  case 'UNCOMMON':
                    className = 'text-green-300';
                    break;
                  case 'JUNK':
                    className = 'text-zinc-600';
                    break;
                  case 'GHOST':
                    className = 'text-cyan-400 italic tracking-wide';
                    break;
                }
                parts.push({ text: match[0], className });
                lastIndex = match.index + match[0].length;
              }

              // Add remaining text
              if (lastIndex < text.length) {
                parts.push({ text: text.substring(lastIndex) });
              }

              // If no tags found, return original text
              if (parts.length === 0) {
                return [{ text }];
              }

              return parts;
            };

            const parsedParts = parseRarityTags(entry);

            return (
              <div
                key={i}
                className={`border-l-2 pl-3 py-1 animate-in fade-in slide-in-from-bottom-2 ${isAtmosphere
                  ? 'border-red-900/40 duration-700'
                  : 'border-zinc-800 duration-300'
                  }`}
              >
                {/* Render parsed parts with rarity styling */}
                {parsedParts.length > 1 || parsedParts[0]?.className ? (
                  <span>
                    {parsedParts.map((part, idx) => (
                      part.className ? (
                        <span key={idx} className={part.className}>{part.text}</span>
                      ) : (
                        <span key={idx}>{part.text}</span>
                      )
                    ))}
                  </span>
                ) : entry.includes('[GHOST]') ? (
                  <span className="text-cyan-400 italic tracking-wide">{entry}</span>
                ) : entry.includes('You found a') && !entry.includes('vein') ? (
                  <span className="text-purple-400 font-semibold">{entry}</span>
                ) : entry.includes('vein') ? (
                  <span className="text-yellow-400">{entry}</span>
                ) : entry.includes('Defeated') ? (
                  <span className="text-green-400">{entry}</span>
                ) : entry.includes('DIED') || entry.includes('damage') ? (
                  <span className="text-red-400">{entry}</span>
                ) : entry.includes('LEVEL UP') ? (
                  <span className="text-cyan-400 font-bold">{entry}</span>
                ) : (
                  // ATMOSPHERE TEXT - Make it SCARY
                  <span className="text-zinc-600 italic animate-pulse" style={{
                    textShadow: '0 0 8px rgba(127, 29, 29, 0.5)',
                    animationDuration: '3s'
                  }}>
                    {entry}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom fade effect */}
      <div className="h-4 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none absolute bottom-0 left-0 right-0" />
    </div>
  );
}
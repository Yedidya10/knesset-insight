'use client';

interface StatTickerProps {
  items: { label: string; value: string }[];
}

export default function StatTicker({ items }: StatTickerProps) {
  if (items.length === 0) return null;

  // Duplicate items for seamless infinite scroll
  const tickerContent = [...items, ...items];

  return (
    <div className="border-border/20 bg-muted/30 relative overflow-hidden border-t backdrop-blur-sm">
      <div className="animate-ticker flex py-2.5 whitespace-nowrap">
        {tickerContent.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-4 text-xs"
          >
            <span className="font-bold tabular-nums">{item.value}</span>
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-border/50 mx-2">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}

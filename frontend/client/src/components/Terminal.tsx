import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface TerminalLine {
  type: "input" | "output" | "error" | "success" | "info";
  content: string;
  timestamp?: string;
}

interface TerminalProps {
  lines: TerminalLine[];
  className?: string;
}

export function Terminal({ lines, className }: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className={cn(
      "font-mono text-sm bg-black/50 border border-border rounded-md overflow-hidden flex flex-col h-full",
      className
    )}>
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/50" />
        </div>
        <div className="text-xs text-muted-foreground">edgeai-cli — v1.0.0</div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <span className="text-muted-foreground shrink-0">
              {line.timestamp || new Date().toLocaleTimeString()}
            </span>
            <div className="flex-1 break-all">
              {line.type === "input" && (
                <span className="text-primary mr-2">➜</span>
              )}
              <span className={cn(
                line.type === "input" && "text-foreground",
                line.type === "output" && "text-muted-foreground",
                line.type === "error" && "text-destructive",
                line.type === "success" && "text-green-400",
                line.type === "info" && "text-blue-400"
              )}>
                {line.content}
              </span>
            </div>
          </div>
        ))}
        {lines.length === 0 && (
          <div className="text-muted-foreground/50 italic">
            Waiting for input...
          </div>
        )}
      </div>
    </div>
  );
}

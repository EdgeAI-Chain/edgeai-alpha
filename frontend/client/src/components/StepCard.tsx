import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface StepCardProps {
  step: number;
  title: string;
  description: string;
  isActive: boolean;
  isCompleted: boolean;
  isLoading?: boolean;
  onAction?: () => void;
  actionLabel?: string;
  children?: React.ReactNode;
}

export function StepCard({
  step,
  title,
  description,
  isActive,
  isCompleted,
  isLoading,
  onAction,
  actionLabel,
  children
}: StepCardProps) {
  return (
    <Card className={cn(
      "transition-all duration-500 border-l-4",
      isActive ? "border-l-primary shadow-lg shadow-primary/5 scale-[1.02]" : "border-l-transparent opacity-60 hover:opacity-80",
      isCompleted && "border-l-green-500 opacity-80"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full border font-mono text-sm transition-colors",
              isActive ? "border-primary text-primary bg-primary/10" : "border-muted-foreground text-muted-foreground",
              isCompleted && "border-green-500 text-green-500 bg-green-500/10"
            )}>
              {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : step}
            </div>
            <CardTitle className={cn("text-xl font-display", isActive && "text-primary")}>
              {title}
            </CardTitle>
          </div>
          {isActive && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
        </div>
        <CardDescription className="ml-11 text-base">
          {description}
        </CardDescription>
      </CardHeader>
      
      {(isActive || isCompleted) && (
        <CardContent className="ml-11 pt-2 pb-4 animate-in slide-in-from-top-2 fade-in duration-300">
          {children}
        </CardContent>
      )}

      {isActive && onAction && (
        <CardFooter className="ml-11 pt-0 pb-6 animate-in slide-in-from-top-2 fade-in duration-500 delay-100">
          <Button 
            onClick={onAction} 
            disabled={isLoading}
            className="w-full sm:w-auto font-mono uppercase tracking-wider"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {actionLabel || "Execute"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

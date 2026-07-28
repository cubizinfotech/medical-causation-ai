import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/utils/cn";

interface LoadingCardProps {
  title: string;
  description?: string;
  progress?: number;
  className?: string;
}

export function LoadingCard({
  title,
  description,
  progress,
  className,
}: LoadingCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <CardTitle className="animate-pulse-soft">{title}</CardTitle>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      {typeof progress === "number" ? (
        <CardContent>
          <Progress value={progress} />
          <p className="mt-2 text-right text-xs text-muted-foreground">
            {Math.round(progress)}%
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}

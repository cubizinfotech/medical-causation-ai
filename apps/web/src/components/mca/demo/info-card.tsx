import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import type { LucideIcon } from "lucide-react";

interface InfoCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
}

export function InfoCard({ title, description, icon: Icon, className }: InfoCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}

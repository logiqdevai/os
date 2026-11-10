import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";
import { Skeleton } from "./skeleton";

interface LoaderProps {
  className?: string;
  length?: number;
}

export default function Loader({ className, length = 8 }: LoaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length }).map((_, index) => (
        <Card key={index} className="cursor-pointer transition-all duration-200">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-32" />
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

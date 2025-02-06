import * as React from "react"; // ^18.0.0
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  status?: string;
  className?: string;
}

const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, description, actions, status, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-4 pb-6 pt-4 md:flex-row md:items-center md:justify-between",
          className
        )}
        role="banner"
        aria-label={`Page header for ${title}`}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
            {status && (
              <Badge
                variant={
                  status.toLowerCase() === "active"
                    ? "success"
                    : status.toLowerCase() === "draft"
                    ? "secondary"
                    : status.toLowerCase() === "archived"
                    ? "destructive"
                    : "default"
                }
                className="h-6 px-2 text-xs"
              >
                {status}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground md:text-base">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div 
            className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-4"
            role="toolbar"
            aria-label="Page actions"
          >
            {actions}
          </div>
        )}
      </div>
    );
  }
);

PageHeader.displayName = "PageHeader";

export default PageHeader;
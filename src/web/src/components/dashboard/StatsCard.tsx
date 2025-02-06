import React from "react"; // ^18.0.0
import { motion } from "framer-motion"; // ^10.0.0
import { IconType } from "react-icons"; // ^4.0.0
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Tooltip, TooltipProvider } from "../ui/tooltip";
import { cn } from "../../lib/utils";

// Props interface for the StatsCard component
interface StatsCardProps {
  title: string;
  value: number;
  icon: IconType;
  className?: string;
  tooltip?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

// Animation duration constant
const DEFAULT_ANIMATION_DURATION = 0.3;

/**
 * A reusable statistics card component for displaying dashboard metrics
 * with animations and accessibility support.
 */
const StatsCard = React.memo<StatsCardProps>(({
  title,
  value,
  icon: Icon,
  className,
  tooltip,
  "aria-label": ariaLabel,
  "data-testid": dataTestId
}) => {
  // Format value for display with thousands separator
  const formattedValue = new Intl.NumberFormat("en-US").format(value);

  // Animation variants for the value display
  const valueAnimationVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: DEFAULT_ANIMATION_DURATION,
        ease: "easeOut"
      }
    }
  };

  // Icon animation variants
  const iconAnimationVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: {
        duration: DEFAULT_ANIMATION_DURATION,
        ease: "spring"
      }
    }
  };

  const cardContent = (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        "hover:shadow-md dark:hover:shadow-gray-800",
        className
      )}
      aria-label={ariaLabel || `${title} statistics card`}
      data-testid={dataTestId}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle 
          className="text-sm font-medium text-gray-500 dark:text-gray-400"
          aria-label={title}
        >
          {title}
        </CardTitle>
        <motion.div
          initial="initial"
          animate="animate"
          variants={iconAnimationVariants}
          className="p-2 rounded-full bg-primary/10 dark:bg-primary/20"
        >
          <Icon 
            className="w-4 h-4 text-primary" 
            aria-hidden="true"
          />
        </motion.div>
      </CardHeader>
      <CardContent>
        <motion.div
          initial="initial"
          animate="animate"
          variants={valueAnimationVariants}
          key={value} // Trigger animation on value change
          className="text-2xl font-bold text-gray-900 dark:text-gray-100"
        >
          {formattedValue}
        </motion.div>
      </CardContent>
    </Card>
  );

  // Wrap with tooltip if provided
  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip content={tooltip}>
          {cardContent}
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
});

// Display name for debugging
StatsCard.displayName = "StatsCard";

export default StatsCard;
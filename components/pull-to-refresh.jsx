"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({
  children,
  className,
  onRefresh,
}) {
  const [pullDistance, setPullDistance] = React.useState(0);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const containerRef = React.useRef(null);
  const startYRef = React.useRef(0);
  const isPullingRef = React.useRef(false);

  // Check if mobile
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleTouchStart = React.useCallback((e) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;

    // Only start if scrolled to top
    if (container.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  }, [isRefreshing]);

  const handleTouchMove = React.useCallback(
    (e) => {
      if (!isPullingRef.current || isRefreshing) return;
      const container = containerRef.current;
      if (!container) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 0 && container.scrollTop === 0) {
        e.preventDefault();
        const distance = Math.min(diff * 0.5, MAX_PULL);
        setPullDistance(distance);
      }
    },
    [isRefreshing]
  );

  const handleTouchEnd = React.useCallback(async () => {
    if (!isPullingRef.current || isRefreshing) return;
    isPullingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);

      try {
        if (onRefresh) {
          await onRefresh();
        } else {
          // Default: reload the page
          window.location.reload();
        }
      } catch (error) {
        console.error("Refresh error:", error);
      }

      // Reset after a short delay
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 500);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  React.useEffect(() => {
    if (!isMobile) return;

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full overflow-auto", className)}
    >
      {/* Pull indicator */}
      {isMobile && (
        <div
          className="absolute left-0 right-0 flex items-center justify-center transition-transform duration-200 ease-out"
          style={{
            transform: `translateY(${pullDistance - 40}px)`,
            opacity: pullDistance / PULL_THRESHOLD,
          }}
        >
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-md",
              isRefreshing && "animate-spin"
            )}
          >
            <RefreshCw
              className="h-5 w-5 text-primary"
              style={{
                transform: isRefreshing
                  ? "none"
                  : `rotate(${(pullDistance / MAX_PULL) * 360}deg)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Content with pull offset */}
      <div
        style={{
          transform: isMobile ? `translateY(${pullDistance}px)` : "none",
          transition: isPullingRef.current ? "none" : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}

import React from "react";

interface DotsLoaderProps {
  /** Optional text to display below the dots */
  text?: string;
  /** Size of each dot: 'sm' (6px), 'md' (10px), or 'lg' (14px) */
  size?: "sm" | "md" | "lg";
  /** Color class for the dots (e.g. 'bg-[#044d73]' or 'bg-white') */
  color?: string;
  /** Whether to render as a full page / screen overlay */
  fullPage?: boolean;
  /** Additional custom classes */
  className?: string;
}

const SIZES = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

const GAPS = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-2.5",
};

export function DotsLoader({
  text,
  size = "md",
  color = "bg-[#044d73]",
  fullPage = false,
  className = "",
}: DotsLoaderProps) {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`flex items-center justify-center ${GAPS[size]}`}>
        <span
          className={`${SIZES[size]} rounded-full ${color} animate-dot-bounce`}
          style={{ animationDelay: "-0.32s" }}
        />
        <span
          className={`${SIZES[size]} rounded-full ${color} animate-dot-bounce`}
          style={{ animationDelay: "-0.16s" }}
        />
        <span
          className={`${SIZES[size]} rounded-full ${color} animate-dot-bounce`}
          style={{ animationDelay: "0s" }}
        />
      </div>
      {text && (
        <p className="text-xs sm:text-sm font-medium tracking-wide text-slate-500 animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}

export default DotsLoader;

"use client";

import { useAnimatedCounter } from "@/app/hooks/use-animated-counter";


interface AnimatedStatValueProps {
  value: number;
  format?: (n: number) => string; 
  className?: string;
}

export function AnimatedStatValue({ value, format, className }: AnimatedStatValueProps) {
  const animated = useAnimatedCounter(value);
  return <span className={className}>{format ? format(animated) : animated}</span>;
}
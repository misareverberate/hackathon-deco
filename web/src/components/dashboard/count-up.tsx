import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  ariaLabel?: string;
}

export function CountUp({
  value,
  duration = 1.4,
  decimals = 0,
  className,
  ariaLabel,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    duration,
    bounce: 0,
  });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView) {
      return;
    }
    motionValue.set(value);
    const unsubscribe = spring.on("change", (latest) => {
      setDisplay(latest.toFixed(decimals));
    });
    return () => unsubscribe();
  }, [inView, value, decimals, motionValue, spring]);

  return (
    <span ref={ref} className={className} aria-label={ariaLabel}>
      {display}
    </span>
  );
}

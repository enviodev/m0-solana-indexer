"use client";

// Spring-animated numeric display: when live polling delivers a new value the
// number physically rolls to it instead of snapping — the visceral "this page
// is alive" cue. Non-numeric formats (bigintDecimals strings beyond double
// precision) render statically; correctness beats motion.

import { useEffect, useRef, useState } from "react";
import { useMotionValue, useSpring } from "framer-motion";
import { formatValue } from "@/lib/data";
import type { Format } from "@/lib/types";

export function AnimatedNumber({
  value,
  format,
  decimals,
  fractionDigits,
}: {
  value: unknown;
  format?: Format;
  decimals?: number;
  fractionDigits?: number;
}) {
  const numeric = Number(value);
  const animatable =
    Number.isFinite(numeric) &&
    format !== "bigintDecimals" &&
    format !== "signedDecimals" &&
    Math.abs(numeric) < Number.MAX_SAFE_INTEGER;

  const motion = useMotionValue(animatable ? numeric : 0);
  const spring = useSpring(motion, { stiffness: 90, damping: 22, mass: 0.6 });
  const [display, setDisplay] = useState(() => formatValue(value, format, decimals, fractionDigits));
  const first = useRef(true);

  useEffect(() => {
    if (!animatable) {
      setDisplay(formatValue(value, format, decimals, fractionDigits));
      return;
    }
    if (first.current) {
      // No entry roll from 0 — start where the data starts.
      first.current = false;
      motion.jump(numeric);
      setDisplay(formatValue(numeric, format, decimals));
      return;
    }
    motion.set(numeric);
  }, [numeric, animatable, value, format, decimals, fractionDigits, motion]);

  useEffect(() => {
    if (!animatable) return;
    return spring.on("change", (v) => setDisplay(formatValue(v, format, decimals)));
  }, [spring, animatable, format, decimals]);

  return <span className="stat-number">{display}</span>;
}

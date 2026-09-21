import React, { useState, useEffect, useRef } from 'react';

/**
 * AnimatedNumber: Precision ticker / odometer animation.
 * Seamlessly interpolates from current live value to new target value without jerks.
 */
export default function AnimatedNumber({ 
  value = 0, 
  duration = 600, 
  decimals = 0, 
  prefix = "", 
  suffix = "", 
  className = "" 
}) {
  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  const [displayValue, setDisplayValue] = useState(numValue);
  const currentValRef = useRef(numValue);
  const animRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    // Always start interpolation from the EXACT current displayed value
    const startVal = currentValRef.current;
    const endVal = numValue;
    
    if (Math.abs(startVal - endVal) < 0.0001) {
      currentValRef.current = endVal;
      setDisplayValue(endVal);
      return;
    }

    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }

    startTimeRef.current = performance.now();

    const tick = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);
      
      // Smooth easeOutCubic transition
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * ease;
      
      currentValRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        currentValRef.current = endVal;
        setDisplayValue(endVal);
      }
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [numValue, duration]);

  const formatted = displayValue.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

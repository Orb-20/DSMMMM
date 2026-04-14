import { useEffect, useRef, useState } from 'react';
import anime from 'animejs';

// Numeric easing via anime.js. format: 'pct' | 'num' | 'int' | 'dollar'.
export default function AnimatedNumber({
  value,
  format = 'num',
  duration = 1200,
  decimals = 2,
  prefix = '',
  suffix = '',
}) {
  const [display, setDisplay] = useState(0);
  const obj = useRef({ v: 0 });

  useEffect(() => {
    const target = Number(value) || 0;
    const anim = anime({
      targets: obj.current,
      v: target,
      duration,
      easing: 'easeOutCubic',
      update: () => setDisplay(obj.current.v),
    });
    return () => anim.pause();
  }, [value, duration]);

  let rendered;
  if (format === 'pct')     rendered = (display * 100).toFixed(decimals) + '%';
  else if (format === 'int')    rendered = Math.round(display).toString();
  else if (format === 'dollar') rendered = '$' + display.toLocaleString(undefined, { maximumFractionDigits: 0 });
  else                          rendered = display.toFixed(decimals);

  return <span>{prefix}{rendered}{suffix}</span>;
}

import { useEffect, useState } from "react";

export default function Typewriter({
  text,
  wordDelay = 450,
  className = "",
}: {
  text: string;
  wordDelay?: number;
  className?: string;
}) {
  const words = text.trim().split(/\s+/);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!words.length) return;

    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= words.length) {
        clearInterval(interval);
      }
    }, wordDelay);

    return () => clearInterval(interval);
  }, [text, wordDelay]);

  return (
    <span className={`typewriter ${className}`}>
      {words.slice(0, visibleCount).join(" ")}
      <span className="typing-cursor">|</span>
    </span>
  );
}
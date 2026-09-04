import { animate } from "framer-motion";
import { useEffect, useState } from "react";

export function useAnimatedNumber(target: number, duration = 1.15) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, target, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => setValue(Math.round(Number(latest)))
    });
    return () => controls.stop();
  }, [target, duration]);

  return value;
}

import { m, useReducedMotion } from "framer-motion";

const variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};

export default function PageWrapper({ children }) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className="w-full h-full">{children}</div>;
  }

  return (
    <m.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="w-full h-full"
    >
      {children}
    </m.div>
  );
}

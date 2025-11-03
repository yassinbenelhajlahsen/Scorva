import { motion } from "framer-motion";

const variants = {
  initial:  { opacity: 0, y: 20 },
  animate:  { opacity: 1, y:  0 },
  exit:     { opacity: 0, y: -20 },
};

export default function PageWrapper({ children }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}

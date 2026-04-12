export const EASE_OUT_EXPO = [0.22, 1, 0.36, 1];

export const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT_EXPO } },
};

export const scoreUpdateVariants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: 20, transition: { duration: 0.15 } },
};

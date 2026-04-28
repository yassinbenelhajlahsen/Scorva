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

export const monthSlideVariants = {
  initial: (dir) => ({ x: dir * 40, opacity: 0 }),
  animate: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.22, ease: EASE_OUT_EXPO, staggerChildren: 0.06 },
  },
  exit: (dir) => ({
    x: dir * -40,
    opacity: 0,
    transition: { duration: 0.15, ease: EASE_OUT_EXPO },
  }),
};

export const monthSlideItemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT_EXPO } },
};

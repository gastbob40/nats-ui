/**
 * Framer Motion animation variants and utilities
 * Following Material Design motion principles and industry best practices
 *
 * Duration guidelines:
 * - Small elements (icons, chips): 100-200ms
 * - Medium elements (cards, dialogs): 200-300ms
 * - Large elements (panels, pages): 300-400ms
 *
 * Easing curves:
 * - Ease-out (deceleration): Elements entering screen - [0.0, 0.0, 0.2, 1]
 * - Ease-in (acceleration): Elements exiting screen - [0.4, 0.0, 1, 1]
 * - Standard (ease-in-out): Moving between positions - [0.4, 0.0, 0.2, 1]
 */

import { type Variants, type Transition } from 'framer-motion';

/**
 * Standard easing curves from Material Design
 */
export const easings = {
  // Deceleration - for elements entering
  easeOut: [0.0, 0.0, 0.2, 1] as const,
  // Acceleration - for elements exiting
  easeIn: [0.4, 0.0, 1, 1] as const,
  // Standard - for moving between positions
  standard: [0.4, 0.0, 0.2, 1] as const,
  // Sharp - for quick transitions
  sharp: [0.4, 0.0, 0.6, 1] as const,
} as const;

/**
 * Fade in animation with proper easing (200ms for medium elements)
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: easings.easeOut
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: easings.easeIn
    }
  }
};

/**
 * Slide up animation with fade (250ms for medium elements)
 */
export const slideUp: Variants = {
  hidden: {
    opacity: 0,
    y: 16
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: easings.easeOut
    }
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: easings.easeIn
    }
  }
};

/**
 * Slide in from left (200ms for small transitions)
 */
export const slideInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -16
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      ease: easings.easeOut
    }
  }
};

/**
 * Slide in from right (200ms for small transitions)
 */
export const slideInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 16
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      ease: easings.easeOut
    }
  }
};

/**
 * Scale animation for cards and modals (250ms for medium elements)
 */
export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: easings.easeOut
    }
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: {
      duration: 0.2,
      ease: easings.easeIn
    }
  }
};

/**
 * Stagger container for lists (60ms between items per Material Design)
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0
    }
  }
};

/**
 * Stagger item for use with staggerContainer (200ms for small elements)
 */
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 8
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: easings.easeOut
    }
  }
};

/**
 * Pulse animation for status indicators (subtle 2s loop)
 */
export const pulse = {
  scale: [1, 1.08, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: easings.standard
  }
};

/**
 * Spin animation for loading states
 */
export const spin = {
  rotate: 360,
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: 'linear'
  }
};

/**
 * Spring transition for icons (150ms with proper physics)
 * Use for small interactive elements
 */
export const iconSpring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 25,
  mass: 0.5
};

/**
 * Standard spring for medium elements (200ms feel)
 */
export const standardSpring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 1
};

/**
 * Smooth transition for layout changes (300ms)
 */
export const smoothTransition: Transition = {
  duration: 0.3,
  ease: easings.standard
};

/**
 * Quick transition for small elements (150ms)
 */
export const quickTransition: Transition = {
  duration: 0.15,
  ease: easings.sharp
};

/**
 * Number count-up animation hook utility
 */
export const useCountUp = (end: number, duration: number = 1) => {
  return {
    initial: 0,
    animate: end,
    transition: {
      duration,
      ease: 'easeOut'
    }
  };
};

/**
 * Shimmer animation for skeleton loaders
 */
export const shimmer: Variants = {
  initial: {
    backgroundPosition: '-200% 0'
  },
  animate: {
    backgroundPosition: '200% 0',
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear'
    }
  }
};

/**
 * Bounce animation for attention-grabbing elements
 */
export const bounce: Variants = {
  initial: { y: 0 },
  animate: {
    y: [-2, 0, -2],
    transition: {
      duration: 0.6,
      repeat: 3,
      ease: 'easeInOut'
    }
  }
};

/**
 * Icon rotation animation
 */
export const rotateIcon: Variants = {
  initial: { rotate: 0 },
  animate: {
    rotate: 360,
    transition: {
      duration: 0.5,
      ease: 'easeInOut'
    }
  }
};

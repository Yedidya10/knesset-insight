'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { type ReactNode } from 'react';

interface AnimatedSectionProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  delay?: number;
}

export default function AnimatedSection({
  children,
  delay = 0,
  ...props
}: AnimatedSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

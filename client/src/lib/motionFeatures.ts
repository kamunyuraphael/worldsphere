// Loaded on demand by <LazyMotion> so the animation engine stays off the critical path.
// domMax (not domAnimation) because Stories and AnimatedCardGrid use `layout` reflow animations.
import { domMax } from 'framer-motion';
export default domMax;

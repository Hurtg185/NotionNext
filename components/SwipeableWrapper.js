// components/SwipeableWrapper.js
import { useSwipeable } from 'react-swipeable'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'

const SwipeableWrapper = ({ children, prevPage, nextPage }) => {
  const router = useRouter()

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (nextPage) router.push(nextPage)
    },
    onSwipedRight: () => {
      if (prevPage) router.push(prevPage)
    },
    preventScrollOnSwipe: true,
    trackMouse: true
  })

  return (
    <motion.div
      {...handlers}
      style={{ touchAction: 'pan-y' }}
      // 添加页面切换动画
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ type: 'linear', duration: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

export default SwipeableWrapper

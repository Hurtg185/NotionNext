// pages/ai.js
import { LayoutBase } from '@/themes/heo' // 导入基础布局
import AiChatAssistant from '@/components/AiChatAssistant' // 导入你的AI助手组件

/**
 * 这是一个独立的 AI 助手页面。
 * 它不进行任何权限检查，直接渲染 AiChatAssistant 组件。
 * 注意：这样 AI 助手将对所有用户开放，没有试用期限制。
 * 这是在我们暂时放弃 Firebase 登录方案下的临时解决方案。
 */
const AIPage = (props) => {
  return (
    <LayoutBase {...props}>
      <div className="w-full h-full">
        {/* 直接渲染 AI 助手组件，它会撑满整个页面 */}
        <AiChatAssistant />
      </div>
    </LayoutBase>
  )
}

export default AIPage

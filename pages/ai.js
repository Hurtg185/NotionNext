// pages/ai.js
import { useEffect, useState } from 'react'
import { LayoutBase } from '@/themes/heo' // 导入基础布局
import AiChatAssistant from '@/components/AiChatAssistant' // 导入你的AI助手组件
import {
  watchAuthState,
  upgradeAnonymousUser,
  firebaseSignOut,
  checkAIAssistantPermission,
} from '@/lib/firebase'

const AIPage = (props) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = watchAuthState(async (user) => {
      setCurrentUser(user)
      if (user) {
        const permission = await checkAIAssistantPermission(user)
        setHasPermission(permission)
      } else {
        setHasPermission(false)
      }
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleUpgradeAccount = async () => {
    try {
      await upgradeAnonymousUser()
      // 升级成功后，watchAuthState 会自动更新状态
    } catch (error) {
      // 错误已在 firebase.js 中 alert
    }
  }

  return (
    <LayoutBase {...props}>
      <div className="max-w-4xl mx-auto px-5 py-8">
        {isLoading && <p>正在验证您的权限...</p>}
        {!isLoading && hasPermission && <AiChatAssistant />}
        {!isLoading && !hasPermission && (
          <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <h2 className="text-2xl font-bold mb-4">访问权限不足</h2>
            {currentUser && currentUser.isAnonymous ? (
              <>
                <p className="mb-4">您的试用期已结束。请先使用 Google 保存进度，然后联系我们购买永久激活码。</p>
                <button
                  onClick={handleUpgradeAccount}
                  className="w-full mb-2 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors font-bold"
                >
                  <i className="fab fa-google mr-2"></i> 使用 Google 保存进度
                </button>
              </>
            ) : (
              <p className="mb-4">您的试用期已结束。请联系我们购买永久激活码以继续使用 AI 助手。</p>
            )}
          </div>
        )}
      </div>
    </LayoutBase>
  )
}

export default AIPage

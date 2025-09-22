// pages/_app.js (控制底部导航栏渲染)

import '@/styles/globals.css'
import '@/styles/utility-patterns.css'
import '@/styles/notion.css'
import 'react-notion-x/src/styles.css'
import { AuthProvider } from '../lib/AuthContext'
import { DrawerProvider } from '../lib/DrawerContext' 

import useAdjustStyle from '@/hooks/useAdjustStyle'
import { GlobalContextProvider } from '@/lib/global'
import { getBaseLayoutByTheme } from '@/themes/theme'
import { useRouter } from 'next/router'
import { useCallback, useMemo, useEffect } from 'react'
import { getQueryParam } from '../lib/utils'

import BLOG from '@/blog.config'
import ExternalPlugins from '@/components/ExternalPlugins'
import SEO from '@/components/SEO'

// 【新增】导入底部导航栏组件
import BottomNavBar from '@/themes/heo/components/BottomNavBar'; 

// 【新增】导入在线状态初始化函数
import { initializePresence } from '@/lib/presence'; 

const MyApp = ({ Component, pageProps }) => {
  useAdjustStyle()
  const route = useRouter()

  // 【新增】在整个应用的生命周期中只运行一次，初始化在线状态监听
  useEffect(() => {
    initializePresence();
  }, []);

  // 【新增】判断是否应该隐藏底部导航栏
  // 例如：在 /forum/messages 页面或 /learn 页面隐藏
  // 你可以根据实际需求调整这里的逻辑
  const shouldHideBottomNav = useMemo(() => {
    // 假设在 /forum 及其所有子路由下隐藏，但 /forum/messages/index.js 是显示底部导航的
    // 根据你的需求，你希望在社区页面隐藏导航按钮
    // 如果 /forum 是社区主页，那么就隐藏
    // const path = route.pathname;
    // return path === '/forum' || path.startsWith('/learn'); // 示例：在 /forum 和 /learn 下隐藏
    
    // 【核心修改】在 /forum 页面及其所有子页面隐藏底部导航栏
    // 除非它是 /forum/messages 页面 (因为消息页面需要底部导航)
    // 根据你之前提供的 BottomNavBar，消息页面是 /forum/messages
    // 所以在 /forum/messages 应该显示，在 /forum (社区主页) 应该隐藏
    const path = route.pathname;
    const hideOnForumMain = path === '/forum'; // 隐藏社区主页
    const hideOnPostDetail = path.startsWith('/forum/post/'); // 隐藏帖子详情页
    const hideOnLearn = path.startsWith('/learn'); // 隐藏学习页面
    
    return hideOnForumMain || hideOnPostDetail || hideOnLearn;

  }, [route.pathname]);


  const theme = useMemo(() => {
    return (
      getQueryParam(route.asPath, 'theme') ||
      pageProps?.NOTION_CONFIG?.THEME ||
      BLOG.THEME
    )
  }, [route])

  const GLayout = useCallback(
    props => {
      const Layout = getBaseLayoutByTheme(theme)
      return <Layout {...props} />
    },
    [theme]
  )

  const content = (
    <GlobalContextProvider {...pageProps}>
      <GLayout {...pageProps}>
        <SEO {...pageProps} />
        <Component {...pageProps} />
      </GLayout>
      <ExternalPlugins {...pageProps} />
      
      {/* 【核心修改】根据 shouldHideBottomNav 的值条件渲染底部导航栏 */}
      {!shouldHideBottomNav && <BottomNavBar />}
    </GlobalContextProvider>
  )
  
  return (
    <AuthProvider>
      <DrawerProvider>
        {content}
      </DrawerProvider>
    </AuthProvider>
  )
}

export default MyApp

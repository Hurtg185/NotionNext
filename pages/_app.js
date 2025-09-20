// pages/_app.js (添加在线状态监听初始化)

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
import { useCallback, useMemo, useEffect } from 'react' // 【修改】导入 useEffect
import { getQueryParam } from '../lib/utils'

import BLOG from '@/blog.config'
import ExternalPlugins from '@/components/ExternalPlugins'
import SEO from '@/components/SEO'

// 【新增】导入在线状态初始化函数
import { initializePresence } from '@/lib/presence'; 

const MyApp = ({ Component, pageProps }) => {
  useAdjustStyle()
  const route = useRouter()

  // 【新增】在整个应用的生命周期中只运行一次，初始化在线状态监听
  useEffect(() => {
    initializePresence();
  }, []); // 空依赖数组确保只运行一次

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

// pages/_app.js

import '@/styles/globals.css'
import '@/styles/utility-patterns.css'
import '@/styles/notion.css'
import 'react-notion-x/src/styles.css'
import useAdjustStyle from '@/hooks/useAdjustStyle'
import { GlobalContextProvider } from '@/lib/global'
import { getBaseLayoutByTheme } from '@/themes/theme'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { getQueryParam } from '../lib/utils'
import BLOG from '@/blog.config'
import ExternalPlugins from '@/components/ExternalPlugins'
import SEO from '@/components/SEO'
import { zhCN } from '@clerk/localizations'
import dynamic from 'next/dynamic'
import Script from 'next/script' // 确保 Script 组件已导入

import { GlobalStyle } from '@/components/GlobalStyle'
import SplashScreen from '@/components/SplashScreen'

const ClerkProvider = dynamic(() =>
  import('@clerk/nextjs').then(m => m.ClerkProvider)
)

const MyApp = ({ Component, pageProps }) => {
  useAdjustStyle()
  const route = useRouter()
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

  const enableClerk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const content = (
    <GlobalContextProvider {...pageProps}>
      <GLayout {...pageProps}>
        <SEO {...pageProps} />
        <Component {...pageProps} />
        <GlobalStyle />
      </GLayout>
      <ExternalPlugins {...pageProps} />
    </GlobalContextProvider>
  )
  return (
    <>
      <SplashScreen />
      
      {/* --- 核心修改：使用 githack 提供的可靠 CDN 链接 --- */}
      <Script
        src="https://raw.githack.com/zh-lx/pinyin-pro/master/dist/pinyin-pro.iife.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('Githack 拼音库 (pinyin-pro) 已成功加载！');
        }}
      />

      {enableClerk ? (
        <ClerkProvider localization={zhCN}>{content}</ClerkProvider>
      ) : (
        content
      )}
    </>
  )
}

export default MyApp

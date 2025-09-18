// pages/_document.js (沉浸式状态栏最终版)

import BLOG from '@/blog.config'
import Document, { Head, Html, Main, NextScript } from 'next/document'

const darkModeScript = `
(function() {
  const darkMode = localStorage.getItem('darkMode')
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const defaultAppearance = '${BLOG.APPEARANCE || 'auto'}'
  let shouldBeDark = darkMode === 'true' || darkMode === 'dark'

  if (darkMode === null) {
    if (defaultAppearance === 'dark') {
      shouldBeDark = true
    } else if (defaultAppearance === 'auto') {
      const date = new Date()
      const hours = date.getHours()
      const darkTimeStart = ${BLOG.APPEARANCE_DARK_TIME ? BLOG.APPEARANCE_DARK_TIME[0] : 18}
      const darkTimeEnd = ${BLOG.APPEARANCE_DARK_TIME ? BLOG.APPEARANCE_DARK_TIME[1] : 6}
      shouldBeDark = prefersDark || (hours >= darkTimeStart || hours < darkTimeEnd)
    }
  }
  
  document.documentElement.classList.add(shouldBeDark ? 'dark' : 'light')
})()
`

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    return (
      <Html lang={BLOG.LANG}>
        <Head>
          {/* 
            【核心修改】: 添加这两个 meta 标签
            - 'theme-color' 控制了浏览器UI(如地址栏)的颜色
            - 'apple-mobile-web-app-status-bar-style' 专门用于iOS设备
          */}
          <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
          <meta name="theme-color" content="#18171d" media="(prefers-color-scheme: dark)" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />

          {/* 您原来的预加载字体 */}
          {BLOG.FONT_AWESOME && (
            <>
              <link
                rel='preload'
                href={BLOG.FONT_AWESOME}
                as='style'
                crossOrigin='anonymous'
              />
              <link
                rel='stylesheet'
                href={BLOG.FONT_AWESOME}
                crossOrigin='anonymous'
                referrerPolicy='no-referrer'
              />
            </>
          )}

          {/* 您原来的深色模式脚本 */}
          <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
        </Head>

        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument

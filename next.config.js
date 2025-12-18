const { THEME } = require('./blog.config')
const fs = require('fs')
const path = require('path')
const BLOG = require('./blog.config')
const { extractLangPrefix } = require('./lib/utils/pageId')

// 打包时是否分析代码
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: BLOG.BUNDLE_ANALYZER
})

// 扫描项目 /themes下的目录名
const themes = scanSubdirectories(path.resolve(__dirname, 'themes'))

// 检测用户开启的多语言
const locales = (function () {
  // 根据BLOG_NOTION_PAGE_ID 检查支持多少种语言数据.
  const langs = [BLOG.LANG]
  if (BLOG.NOTION_PAGE_ID.indexOf(',') > 0) {
    const siteIds = BLOG.NOTION_PAGE_ID.split(',')
    for (let index = 0; index < siteIds.length; index++) {
      const siteId = siteIds[index]
      const prefix = extractLangPrefix(siteId)
      if (prefix) {
        if (!langs.includes(prefix)) {
          langs.push(prefix)
        }
      }
    }
  }
  return langs
})()

// 编译前执行
const preBuild = (function () {
  if (
    !process.env.npm_lifecycle_event === 'export' &&
    !process.env.npm_lifecycle_event === 'build'
  ) {
    return
  }
  // 删除 public/sitemap.xml 文件
  const sitemapPath = path.resolve(__dirname, 'public', 'sitemap.xml')
  if (fs.existsSync(sitemapPath)) {
    fs.unlinkSync(sitemapPath)
    console.log('Deleted existing sitemap.xml from public directory')
  }

  const sitemap2Path = path.resolve(__dirname, 'sitemap.xml')
  if (fs.existsSync(sitemap2Path)) {
    fs.unlinkSync(sitemap2Path)
    console.log('Deleted existing sitemap.xml from root directory')
  }
})()

function scanSubdirectories(directory) {
  const subdirectories = []
  if (!fs.existsSync(directory)) return subdirectories
  fs.readdirSync(directory).forEach(file => {
    const fullPath = path.join(directory, file)
    const stats = fs.statSync(fullPath)
    if (stats.isDirectory()) {
      subdirectories.push(file)
    }
  })
  return subdirectories
}

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // 1. 强制设为静态导出模式
  output: 'export',
  
  // 2. 强制添加斜杠
  trailingSlash: true,

  eslint: {
    ignoreDuringBuilds: true
  },
  
  staticPageGenerationTimeout: 120,
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  swcMinify: true,

  modularizeImports: {
    '@heroicons/react/24/outline': {
      transform: '@heroicons/react/24/outline/{{member}}'
    },
    '@heroicons/react/24/solid': {
      transform: '@heroicons/react/24/solid/{{member}}'
    }
  },

  // 【精准修复点】
  // 在静态导出模式下，Next.js 要求配置对象中绝对不能出现 i18n 键。
  // 我们使用逻辑判断：如果是构建/导出过程，完全不定义这个属性。
  ...( (process.env.npm_lifecycle_event === 'export' || process.env.EXPORT === 'true') 
    ? {} 
    : {
        i18n: {
          defaultLocale: BLOG.LANG,
          locales: locales
        }
      }
  ),

  images: {
    unoptimized: true, // 静态导出模式必须禁用图片优化
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [
      'gravatar.com',
      'www.notion.so',
      'avatars.githubusercontent.com',
      'images.unsplash.com',
      'source.unsplash.com',
      'p1.qhimg.com',
      'webmention.io',
      'ko-fi.com'
    ],
    loader: 'default',
    minimumCacheTTL: 604800, 
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
  },

  // 生产环境下自动禁用这些在 export 模式中无效的配置
  redirects: (process.env.npm_lifecycle_event === 'export' || process.env.EXPORT === 'true')
    ? undefined
    : async () => {
        return [
          { source: '/feed', destination: '/rss/feed.xml', permanent: true }
        ]
      },

  rewrites: (process.env.npm_lifecycle_event === 'export' || process.env.EXPORT === 'true')
    ? undefined
    : async () => {
        const langsRewrites = []
        if (BLOG.NOTION_PAGE_ID.indexOf(',') > 0) {
          const siteIds = BLOG.NOTION_PAGE_ID.split(',')
          const langs = []
          for (let index = 0; index < siteIds.length; index++) {
            const siteId = siteIds[index]
            const prefix = extractLangPrefix(siteId)
            if (prefix) langs.push(prefix)
          }
          langsRewrites.push(
            { source: `/:locale(${langs.join('|')})/:path*`, destination: '/:path*' },
            { source: `/:locale(${langs.join('|')})`, destination: '/' }
          )
        }
        return [ ...langsRewrites, { source: '/:path*.html', destination: '/:path*' } ]
      },

  webpack: (config, { dev, isServer }) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    config.resolve.alias['@theme-components'] = path.resolve(__dirname, 'themes', THEME)

    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors', chunks: 'all' },
            common: { name: 'common', minChunks: 2, chunks: 'all', enforce: true }
          }
        }
      }
    }

    if (dev || process.env.NODE_ENV_API === 'development') {
      config.devtool = 'eval-source-map'
    }

    config.resolve.modules = [ path.resolve(__dirname, 'node_modules'), 'node_modules' ]
    return config
  },

  experimental: {
    scrollRestoration: true,
    optimizePackageImports: ['@heroicons/react', 'lodash']
  },

  exportPathMap: async function (defaultPathMap) {
    const pages = { ...defaultPathMap }
    delete pages['/sitemap.xml']
    delete pages['/auth']
    return pages
  },

  publicRuntimeConfig: {
    THEMES: themes
  }
}

module.exports = process.env.ANALYZE ? withBundleAnalyzer(nextConfig) : nextConfig

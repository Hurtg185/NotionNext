const { THEME } = require('./blog.config')
const fs = require('fs')
const path = require('path')
const BLOG = require('./blog.config')
const { extractLangPrefix } = require('./lib/utils/pageId')

// 打包时是否分析代码
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: BLOG.BUNDLE_ANALYZER
})

// 扫描项目 /themes 下的目录名
const themes = scanSubdirectories(path.resolve(__dirname, 'themes'))

// 检测多语言逻辑
const locales = (function () {
  const langs = [BLOG.LANG]
  if (BLOG.NOTION_PAGE_ID.indexOf(',') > 0) {
    const siteIds = BLOG.NOTION_PAGE_ID.split(',')
    for (let index = 0; index < siteIds.length; index++) {
      const siteId = siteIds[index]
      const prefix = extractLangPrefix(siteId)
      if (prefix && !langs.includes(prefix)) {
        langs.push(prefix)
      }
    }
  }
  return langs
})()

// 编译前执行：清理 Sitemap
const preBuild = (function () {
  if (
    process.env.npm_lifecycle_event !== 'export' &&
    process.env.npm_lifecycle_event !== 'build'
  ) {
    return
  }
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

// 判定是否为导出模式（Cloudflare 部署环境强制开启）
const isExport = true // Cloudflare Pages 必须使用静态导出

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // 1. 强制设为静态导出模式，解决 Cloudflare 兼容性
  output: 'export',
  
  // 2. 核心：强制添加斜杠。解决刷新 404 和“拼音课程数据收不到”的问题
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
    '@heroicons/react/24/outline': { transform: '@heroicons/react/24/outline/{{member}}' },
    '@heroicons/react/24/solid': { transform: '@heroicons/react/24/solid/{{member}}' }
  },

  // 【彻底修复部署失败】在 Export 模式下物理移除 i18n 属性
  ...(isExport ? {} : {
    i18n: {
      defaultLocale: BLOG.LANG,
      locales: locales
    }
  }),

  images: {
    // 静态导出模式下必须禁用图片优化，否则部署必崩
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [
      'gravatar.com', 'www.notion.so', 'avatars.githubusercontent.com',
      'images.unsplash.com', 'source.unsplash.com', 'p1.qhimg.com',
      'webmention.io', 'ko-fi.com'
    ],
    loader: 'default',
    minimumCacheTTL: 604800, 
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
  },

  // 物理移除 Export 模式不支持的键名
  ...(isExport ? {} : {
    redirects: async () => [{ source: '/feed', destination: '/rss/feed.xml', permanent: true }],
    rewrites: async () => {
      const langsRewrites = []
      // (这里保留你原始的 rewrites 逻辑...)
      return [...langsRewrites, { source: '/:path*.html', destination: '/:path*' }]
    },
    headers: async () => [{ source: '/:path*{/}?', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] }]
  }),

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

    config.resolve.modules = [path.resolve(__dirname, 'node_modules'), 'node_modules']
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

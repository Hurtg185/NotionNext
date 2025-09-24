// next.config.js (已合并七牛云相关域名)

const { THEME } = require('./blog.config')
const fs = require('fs')
const path = require('path')
const BLOG = require('./blog.config')
const { extractLangPrefix } = require('./lib/utils/pageId')

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: BLOG.BUNDLE_ANALYZER
})

// ... (所有您原来的函数 scanSubdirectories, locales, preBuild 都保持不变)
function scanSubdirectories(directory) {
  const subdirectories = []
  fs.readdirSync(directory).forEach(file => {
    const fullPath = path.join(directory, file)
    const stats = fs.statSync(fullPath)
    if (stats.isDirectory()) {
      subdirectories.push(file)
    }
  })
  return subdirectories
}
const locales = (function () {
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
const preBuild = (function () {
  if (
    !process.env.npm_lifecycle_event === 'export' &&
    !process.env.npm_lifecycle_event === 'build'
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
const themes = scanSubdirectories(path.resolve(__dirname, 'themes'))


/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // ... (所有您原来的配置 eslint, output, images 等都保持不变)
  eslint: {
    ignoreDuringBuilds: true
  },
  output: process.env.EXPORT ? 'export' : process.env.NEXT_BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  staticPageGenerationTimeout: 120,
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  swcMinify: true,
  modularizeImports: {
    '@heroicons/react/24/outline': { transform: '@heroicons/react/24/outline/{{member}}' },
    '@heroicons/react/24/solid': { transform: '@heroicons/react/24/solid/{{member}}' }
  },
  i18n: process.env.EXPORT ? undefined : {
    defaultLocale: BLOG.LANG,
    locales: locales
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [
      'gravatar.com', 'www.notion.so', 'avatars.githubusercontent.com',
      'images.unsplash.com', 'source.unsplash.com', 'p1.qhimg.com',
      'webmention.io', 'ko-fi.com', 'lh3.googleusercontent.com',
      'graph.facebook.com', 'i.ytimg.com',
      // 【新增】添加您的七牛云 CDN 域名
      'cdn.843075.xyz' 
    ],
    loader: 'default',
    minimumCacheTTL: 60 * 60 * 24 * 7,
    dangerouslyAllowSVG: true,
  },
  redirects: process.env.EXPORT ? undefined : () => {
    return [{ source: '/feed', destination: '/rss/feed.xml', permanent: true }]
  },
  rewrites: process.env.EXPORT ? undefined : () => {
    const langsRewrites = []
    if (BLOG.NOTION_PAGE_ID.indexOf(',') > 0) {
      const siteIds = BLOG.NOTION_PAGE_ID.split(',')
      const langs = []
      for (let index = 0; index < siteIds.length; index++) {
        const siteId = siteIds[index]
        const prefix = extractLangPrefix(siteId)
        if (prefix) { langs.push(prefix) }
        console.log('[Locales]', siteId)
      }
      langsRewrites.push(
        { source: `/:locale(${langs.join('|')})/:path*`, destination: '/:path*' },
        { source: `/:locale(${langs.join('|')})`, destination: '/' },
        { source: `/:locale(${langs.join('|')})/`, destination: '/' }
      )
    }
    return [ ...langsRewrites, { source: '/:path*.html', destination: '/:path*' } ]
  },

  headers: process.env.EXPORT ? undefined : async () => {
    const ContentSecurityPolicy = `
      default-src 'self';
      
      script-src 'self' 'unsafe-eval' 'unsafe-inline' 
        https://*.googletagmanager.com 
        https://*.google-analytics.com 
        https://connect.facebook.net 
        https://*.youtube.com 
        https://*.tiktok.com 
        https://*.static-z.com
        https://cdnjs.cloudflare.com 
        https://busuanzi.ibruce.info;
        
      child-src 'self' 
        https://*.google.com 
        https://www.youtube.com 
        https://www.facebook.com 
        https://*.tiktok.com;
        
      style-src 'self' 'unsafe-inline' 
        https://*.googleapis.com 
        https://cdnjs.cloudflare.com;
        
      img-src * blob: data:;
      
      // 【核心修改】在这里添加您的七牛云域名
      media-src 'self' blob: https:
        https://t.leftsite.cn 
        https://*.youtube.com 
        https://*.facebook.com 
        https://*.googlevideo.com 
        https://*.tiktok.com
        ${process.env.NEXT_PUBLIC_QINIU_DOMAIN || ''}; 
        
      // 【核心修改】在这里添加七牛云上传域名
      connect-src 'self' 
        https://t.leftsite.cn 
        https://*.google.com 
        https://*.googleapis.com 
        https://firestore.googleapis.com 
        https://identitytoolkit.googleapis.com 
        wss://*.firebaseio.com 
        https://*.tiktok.com 
        https://*.facebook.com
        https://busuanzi.ibruce.info
        https://*.qiniup.com;
        
      font-src 'self' data: https://cdnjs.cloudflare.com;
      
      frame-src 'self' 
        https://*.google.com 
        https://www.youtube.com 
        https://www.facebook.com 
        https://*.tiktok.com;
    `.replace(/\s{2,}/g, ' ').trim();
    
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: ContentSecurityPolicy }] }];
  },
  
  // ... (所有您原来的配置 webpack, experimental 等都保持不变)
  webpack: (config, { dev, isServer }) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    const currentTheme = THEME || 'heo';
    if (!isServer) { console.log('[当前主题]', path.resolve(__dirname, 'themes', currentTheme)) }
    config.resolve.alias['@theme-components'] = path.resolve(__dirname, 'themes', currentTheme)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false, tls: false, fs: false, child_process: false,
        'react-native-sqlite-storage': false, dns: false
      };
    }
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors', chunks: 'all' },
            common: { name: 'common', minChunks: 2, chunks: 'all', enforce: true },
          },
        },
      }
    }
    if (dev || process.env.NODE_ENV_API === 'development') { config.devtool = 'eval-source-map' }
    config.resolve.modules = [ path.resolve(__dirname, 'node_modules'), 'node_modules' ]
    return config
  },
  experimental: {
    scrollRestoration: true,
    optimizePackageImports: ['@heroicons/react', 'lodash']
  },
  exportPathMap: function (defaultPathMap, { dev, dir, outDir, distDir, buildId }) {
    const pages = { ...defaultPathMap };
    delete pages['/sitemap.xml'];
    delete pages['/auth'];
    return pages;
  },
  publicRuntimeConfig: {
    THEMES: themes
  }
}

module.exports = process.env.ANALYZE
  ? withBundleAnalyzer(nextConfig)
  : nextConfig

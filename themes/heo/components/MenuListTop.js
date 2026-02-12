import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import CONFIG from '../config'
import { MenuItemDrop } from './MenuItemDrop'

const ACCOUNT_KEYWORDS = ['账号', '账户', 'account', 'profile', '个人中心', 'user center']
const ACCOUNT_HREF_KEYWORDS = ['/account', '/profile', '/user', '/login', '/dashboard', '/me']

const isAccountLikeLink = (link) => {
  if (!link) return false

  const name = String(link.name || '').toLowerCase()
  const href = String(link.href || '').toLowerCase()
  const icon = String(link.icon || '').toLowerCase()

  const nameHit = ACCOUNT_KEYWORDS.some((k) => name.includes(k.toLowerCase()))
  const hrefHit = ACCOUNT_HREF_KEYWORDS.some((k) => href.includes(k))
  const iconHit = icon.includes('user')

  return nameHit || hrefHit || iconHit
}

export const MenuListTop = (props) => {
  const { customNav, customMenu, hideAccountButton } = props
  const { locale } = useGlobal()

  let links = [
    {
      id: 1,
      icon: 'fa-solid fa-house',
      name: locale.NAV.INDEX,
      href: '/',
      show: siteConfig('HEO_MENU_INDEX', null, CONFIG)
    },
    {
      id: 2,
      icon: 'fas fa-search',
      name: locale.NAV.SEARCH,
      href: '/search',
      show: siteConfig('HEO_MENU_SEARCH', null, CONFIG)
    },
    {
      id: 3,
      icon: 'fas fa-archive',
      name: locale.NAV.ARCHIVE,
      href: '/archive',
      show: siteConfig('HEO_MENU_ARCHIVE', null, CONFIG)
    }
  ]

  if (customNav) {
    links = links.concat(customNav)
  }

  // 如果开启自定义菜单，则覆盖默认菜单
  if (siteConfig('CUSTOM_MENU')) {
    links = customMenu || []
  }

  if (hideAccountButton) {
    links = (links || []).filter((item) => !isAccountLikeLink(item))
  }

  if (!links || links.length === 0) {
    return null
  }

  return (
    <nav id='nav-mobile' className='leading-8 justify-center font-light w-full flex'>
      {links.map((link) => link && link.show && <MenuItemDrop key={link.id || link.href || link.name} link={link} />)}
    </nav>
  )
  }

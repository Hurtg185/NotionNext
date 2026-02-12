import { siteConfig } from '@/lib/config'
import LazyImage from '@/components/LazyImage'
import { useRouter } from 'next/router'
import MenuGroupCard from './MenuGroupCard'
import { MenuListSide } from './MenuListSide'

const ACCOUNT_KEYWORDS = ['账号', '账户', 'account', 'profile', '个人中心', 'user center']
const ACCOUNT_HREF_KEYWORDS = ['/account', '/profile', '/user', '/login', '/dashboard', '/me']

const isAccountLikeLink = (link) => {
  if (!link) return false

  const name = String(link.name || '').toLowerCase()
  const href = String(link.href || '').toLowerCase()

  const nameHit = ACCOUNT_KEYWORDS.some((k) => name.includes(k.toLowerCase()))
  const hrefHit = ACCOUNT_HREF_KEYWORDS.some((k) => href.includes(k))
  const iconHit = String(link.icon || '').toLowerCase().includes('user')

  return nameHit || hrefHit || iconHit
}

/**
 * 侧边抽屉
 */
const SideBar = (props) => {
  const { siteInfo, hideAccountButton, customNav, customMenu } = props
  const router = useRouter()

  const filteredCustomNav = hideAccountButton
    ? (customNav || []).filter((item) => !isAccountLikeLink(item))
    : customNav

  const filteredCustomMenu = hideAccountButton
    ? (customMenu || []).filter((item) => !isAccountLikeLink(item))
    : customMenu

  const nextProps = {
    ...props,
    customNav: filteredCustomNav,
    customMenu: filteredCustomMenu
  }

  return (
    <div id='side-bar'>
      <div className='h-52 w-full flex justify-center'>
        <div>
          <button
            type='button'
            onClick={() => router.push('/')}
            className='justify-center items-center flex py-6 dark:text-gray-100 transform duration-200 active:scale-95 cursor-pointer'
            aria-label='Go Home'
          >
            <LazyImage
              src={siteInfo?.icon}
              className='rounded-full ring-2 ring-white/70 shadow-lg'
              width={80}
              alt={siteConfig('AUTHOR')}
            />
          </button>
          <MenuGroupCard {...nextProps} />
        </div>
      </div>

      <MenuListSide {...nextProps} />
    </div>
  )
}

export default SideBar

import VerticalShortVideoPlayer from '@/themes/heo/components/VerticalShortVideoPlayer'
import { LayoutBase } from '@/themes/heo';

export default function VideosPage() {
  return (
    // 使用一个简单的布局或直接渲染
    <LayoutBase>
      <VerticalShortVideoPlayer useProxy={false} />
    </LayoutBase>
  )
}

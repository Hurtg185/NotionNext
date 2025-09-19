// components/Avatar.js

import Link from 'next/link';
import Image from 'next/image'; // 推荐使用 Next.js 的 Image 组件，性能更好

const Avatar = ({ userId, src, alt, size = 16, className = '', isLink = true }) => {
  const dimensions = `w-${size} h-${size}`;
  const defaultAvatar = 'https://www.gravatar.com/avatar?d=mp';

  // 如果 src 无效，则使用默认头像
  const imageSrc = src || defaultAvatar;

  const AvatarImage = (
    <div className={`relative ${dimensions} ${className}`}>
      <Image
        src={imageSrc}
        alt={alt || 'User Avatar'}
        layout="fill"
        className="rounded-full object-cover"
      />
    </div>
  );

  if (isLink && userId) {
    return (
      <Link href={`/profile/${userId}`} passHref>
        <a className="cursor-pointer">{AvatarImage}</a>
      </Link>
    );
  }

  return AvatarImage;
};

export default Avatar;

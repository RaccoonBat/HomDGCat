import { useState } from 'react';

/** 游戏图片及加载失败时的占位展示参数。 */
interface GameImageProps {
  /** manifest 提供的站内图片 URL，空字符串显示占位。 */
  src: string;
  /** 图片替代文本；纯装饰性图标传空字符串。 */
  alt: string;
  /** 调用方控制尺寸与排版的 CSS Modules 类名。 */
  className?: string;
  /** 是否延迟加载，默认 true；详情主图设置为 false。 */
  lazy?: boolean;
}

export function GameImage({ src, alt, className, lazy = true }: GameImageProps) {
  const [failed, setFailed] = useState('');
  return src && failed !== src ? (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={lazy ? 'lazy' : 'eager'}
      onError={() => setFailed(src)}
    />
  ) : (
    <div className={className} role="img" aria-label={`${alt}（暂无图片）`}>
      暂无图片
    </div>
  );
}

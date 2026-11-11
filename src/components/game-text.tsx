import { plainGameText } from '@/utils/game-text';

/** 以安全文本呈现的游戏正文参数。 */
interface GameTextProps {
  /** 已本地化的正文，可包含游戏颜色标记、换行和主角称谓占位符。 */
  text: string;
}

export function GameText({ text }: GameTextProps) {
  return (
    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.85 }}>
      {plainGameText(text)}
    </div>
  );
}

/** 游戏哈希可能超过 JS 安全整数范围，必须先用 BigInt 取模再转分片名。 */
export function textBucket(hash: string, count = 256): string {
  return (BigInt(hash) % BigInt(count)).toString(16).padStart((count - 1).toString(16).length, '0');
}

/** 将技能 #1[i]、#1[f1]、#1[p] 等占位符替换为当前等级参数；缺参时保留原文。 */
export function formatParameters(text: string, params: unknown[] = []): string {
  return text.replace(
    /#(\d+)\[([ipf])(\d*)\]([%％]?)/g,
    (token: string, index: string, type: string, digits: string, suffix: string) => {
      const param = params[Number(index) - 1];
      const value =
        typeof param === 'object' && param !== null && 'Value' in param ? param.Value : param;
      if (typeof value !== 'number') return token;
      const percent = type === 'p' || Boolean(suffix);
      const scaled = value * (percent ? 100 : 1);
      return (
        String(
          type === 'i'
            ? Math.round(scaled)
            : Number(scaled.toFixed(digits ? Math.min(20, Number(digits)) : 2)),
        ) + (suffix || (percent ? '%' : ''))
      );
    },
  );
}

/** 去除游戏标记并保留换行；结果由 React 文本节点渲染，不作为 HTML 执行。 */
export function plainGameText(text: string): string {
  return text
    .replace(/\\n|<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\{RUBY_B#[^}]*\}([^]*?)\{RUBY_E#\}/g, '$1')
    .replace(/\{(?:NICKNAME|TEXTJOIN#[^}]+)\}/g, '开拓者')
    .replace(/\{[MF]#([^}]*)\}/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

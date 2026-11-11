import { loadDialogues } from '@/services/dialogue-data';
import type { DialogueLine, DialogueRequest, DialogueResponse } from '@/types/dialogue';
/** Worker 独占语料库；页面卸载时 terminate 同时终止请求和解析。 */
const scope = self as unknown as {
  postMessage: (message: DialogueResponse) => void;
  onmessage: ((event: MessageEvent<DialogueRequest>) => void) | null;
};
let lines: DialogueLine[] = [];
const send = (message: DialogueResponse) => scope.postMessage(message);
scope.onmessage = ({ data }) => {
  void (async () => {
    try {
      if (data.type === 'init') {
        const result = await loadDialogues(new AbortController().signal, (message) =>
          send({ type: 'progress', message }),
        );
        lines = result.lines;
        send({ type: 'ready', worlds: result.worlds, total: lines.length });
      } else if (data.type === 'search') {
        const query = data.query.trim().toLocaleLowerCase(),
          speaker = data.speaker.trim().toLocaleLowerCase();
        const selected: DialogueLine[] = [];
        let total = 0;
        for (const line of lines) {
          const world =
            !data.world ||
            (data.world === 'unknown'
              ? !line.worlds.length
              : data.world === 'multiple'
                ? line.worlds.length > 1
                : line.worlds.includes(data.world));
          if (
            world &&
            // 正文输入只匹配正文；说话者由独立筛选框处理，避免混入非正文命中。
            (!query || line.text.toLocaleLowerCase().includes(query)) &&
            (!speaker || line.speaker.toLocaleLowerCase().includes(speaker))
          ) {
            total++;
            if (selected.length < data.limit) selected.push(line);
          }
        }
        send({ type: 'results', request: data.request, lines: selected, total });
      } else {
        const index = lines.findIndex((line) => line.id === data.id);
        send({
          type: 'detail',
          request: data.request,
          found: index >= 0,
          lines: index < 0 ? [] : lines.slice(Math.max(0, index - 2), index + 3),
        });
      }
    } catch (error) {
      send({ type: 'error', message: error instanceof Error ? error.message : '对白加载失败' });
    }
  })();
};

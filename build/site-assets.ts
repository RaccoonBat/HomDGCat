import { createReadStream } from 'node:fs';
import { cp, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const site = fileURLToPath(new URL('../site/', import.meta.url));
// 站点只发布游戏数据和图片；页面、样式和运行库由 Vite 构建。
const directories = new Set(['data', 'images']);
const mimeTypes: Record<string, string> = {
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
};

/** 按 URL 直接读取游戏资料，生产构建复制到 dist，不将整库打进 JS。 */
export function siteAssets(): Plugin {
  let output = '';
  return {
    name: 'site-assets',
    configResolved(config) {
      output = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        let pathname: string;
        try {
          pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
        } catch {
          response.statusCode = 400;
          response.end();
          return;
        }
        const directory = pathname.split('/')[1];
        if (!directory || !directories.has(directory)) {
          next();
          return;
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          response.statusCode = 405;
          response.end();
          return;
        }
        const boundary = resolve(site, directory);
        const file = resolve(site, pathname.slice(1));
        if (!file.startsWith(boundary + sep)) {
          response.statusCode = 403;
          response.end();
          return;
        }
        void stat(file)
          .then((info) => {
            if (!info.isFile()) {
              response.statusCode = 404;
              response.end();
              return;
            }
            response.setHeader(
              'Content-Type',
              mimeTypes[file.split('.').at(-1) ?? ''] ?? 'application/octet-stream',
            );
            response.setHeader('Content-Length', info.size);
            response.setHeader('Cache-Control', 'no-cache');
            if (request.method === 'HEAD') {
              response.end();
              return;
            }
            createReadStream(file)
              .on('error', () => response.destroy())
              .pipe(response);
          })
          .catch(() => {
            response.statusCode = 404;
            response.end();
          });
      });
    },
    async writeBundle() {
      if (!output) return;
      for (const directory of directories) {
        await cp(resolve(site, directory), resolve(output, directory), { recursive: true });
      }
    },
  };
}

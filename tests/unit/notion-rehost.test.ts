import { describe, it, expect } from 'vitest';
import { collectNotionFileUrls, rehostFiles } from '../../server/services/notion.js';
import { LocalMediaProvider } from '../../server/media/index.js';

const SIGNED =
  'https://prod-files-secure.s3.us-west-2.amazonaws.com/ws/abc/photo.png?X-Amz-Signature=1&X-Amz-Expires=3600';
const SIGNED_COVER =
  'https://prod-files-secure.s3.us-west-2.amazonaws.com/ws/def/cover.jpg?X-Amz-Signature=2';

describe('collectNotionFileUrls', () => {
  it('collects file images (also nested) and a file cover, skips external', () => {
    const blocks = [
      { type: 'image', image: { type: 'file', file: { url: SIGNED } } },
      {
        type: 'image',
        image: { type: 'external', external: { url: 'https://example.com/x.png' } },
      },
      {
        type: 'column_list',
        children: [
          {
            type: 'column',
            children: [{ type: 'image', image: { type: 'file', file: { url: SIGNED } } }],
          },
        ],
      },
    ];
    const page = { cover: { type: 'file', file: { url: SIGNED_COVER } } };
    expect(collectNotionFileUrls(blocks, page)).toEqual([SIGNED, SIGNED_COVER]);
  });
});

class MemoryProvider extends LocalMediaProvider {
  store = new Map<string, { data: Buffer; contentType: string }>();
  failUpload = false;
  override async upload(key: string, data: Buffer | Uint8Array, options: { contentType: string }) {
    if (this.failUpload) throw new Error('bucket down');
    this.store.set(key, { data: Buffer.from(data), contentType: options.contentType });
  }
  override async exists(key: string) {
    return this.store.has(key);
  }
}

const fakeFetch = (async () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { 'content-type': 'image/png' },
  })) as typeof fetch;

describe('rehostFiles', () => {
  it('uploads each file and maps it to a docbot:// media URL', async () => {
    const provider = new MemoryProvider();
    const map = await rehostFiles([SIGNED], provider, fakeFetch);
    const mediaUrl = map.get(SIGNED)!;
    expect(mediaUrl).toMatch(/^docbot:\/\/media\/.+\.png$/);
    const stored = provider.store.get(mediaUrl.slice('docbot://media/'.length))!;
    expect(stored.contentType).toBe('image/png');
    expect([...stored.data]).toEqual([1, 2, 3]);
  });

  it('leaves a file out of the map when the upload fails', async () => {
    const provider = new MemoryProvider();
    provider.failUpload = true;
    const map = await rehostFiles([SIGNED], provider, fakeFetch);
    expect(map.size).toBe(0);
  });

  it('leaves a file out of the map when the download fails', async () => {
    const provider = new MemoryProvider();
    const failing = (async () => new Response('gone', { status: 403 })) as typeof fetch;
    const map = await rehostFiles([SIGNED], provider, failing);
    expect(map.size).toBe(0);
  });
});

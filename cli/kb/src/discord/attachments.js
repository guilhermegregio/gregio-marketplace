import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function sanitize(name) {
  return (name || 'file').replace(/[^\w.\-]/g, '_').slice(0, 120);
}

export async function downloadAttachments(message, baseDir) {
  if (!message.attachments?.length) return [];

  const dir = join(baseDir, message.id);
  await mkdir(dir, { recursive: true });

  const saved = [];
  for (const att of message.attachments) {
    try {
      const res = await fetch(att.url);
      if (!res.ok) {
        console.warn(`    ! anexo ${att.filename}: HTTP ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const safeName = sanitize(att.filename);
      const path = join(dir, safeName);
      await writeFile(path, buf);
      saved.push({
        id: att.id,
        filename: att.filename,
        localPath: path,
        size: att.size,
        contentType: att.content_type,
      });
    } catch (err) {
      console.warn(`    ! anexo ${att.filename}: ${err.message}`);
    }
  }
  return saved;
}

import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, serializeFrontmatter, writeFileAtomic, type FrontmatterData } from '@smart-terminal/data';

export interface InstallationIdentity { installationId: string; createdAt: string }

/** Stable local installation identity, deliberately stored outside the synchronized data repository. */
export class InstallationStore {
  constructor(private readonly userDataPath: string, private readonly uuid: () => string = () => crypto.randomUUID(), private readonly clock: () => Date = () => new Date()) {}

  loadOrCreate(): InstallationIdentity {
    const file = path.join(this.userDataPath, 'installation.md');
    try {
      const parsed = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      const id = parsed.data['installation_id'];
      const createdAt = parsed.data['created_at'];
      if (parsed.hasFrontmatter && parsed.data['schema_version'] === 1 && typeof id === 'string' && typeof createdAt === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return { installationId: id, createdAt };
    } catch { /* create below */ }
    const identity = { installationId: this.uuid(), createdAt: this.clock().toISOString() };
    const data: FrontmatterData = { schema_version: 1, installation_id: identity.installationId, created_at: identity.createdAt };
    fs.mkdirSync(this.userDataPath, { recursive: true, mode: 0o700 });
    writeFileAtomic(file, `${serializeFrontmatter(data)}\n`);
    return identity;
  }
}

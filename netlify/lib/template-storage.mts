import { getDeployStore, getStore } from '@netlify/blobs';
import { TEMPLATE_SNAPSHOT_VERSION } from './template-snapshot.mts';

declare const Netlify: {
  context?: { deploy?: { context?: string } };
};

export const TEMPLATE_STORE = 'catalogotop-templates';
export const MAX_TEMPLATES_BYTES = 2_000_000;

export type TemplateStoreSnapshot = {
  schemaVersion: number;
  revision: number;
  updatedAt: string;
  writeId: string;
  templates: unknown[];
};

function isProduction() {
  return Netlify.context?.deploy?.context === 'production';
}

export function templatesStore() {
  return isProduction()
    ? getStore(TEMPLATE_STORE, { consistency: 'strong' })
    : getDeployStore({ name: TEMPLATE_STORE, consistency: 'strong' });
}

export async function currentTemplateSnapshot(): Promise<TemplateStoreSnapshot> {
  const current = await templatesStore().get('current', { type: 'json' });
  if (!current) {
    return {
      schemaVersion: TEMPLATE_SNAPSHOT_VERSION,
      revision: 0,
      updatedAt: '',
      writeId: '',
      templates: []
    };
  }
  return current as TemplateStoreSnapshot;
}

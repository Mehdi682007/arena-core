import { createWebConfig } from '@arena-core/config';
import packageMetadata from '../package.json';

export function getWebConfig() {
  return createWebConfig(process.env, { packageVersion: packageMetadata.version });
}

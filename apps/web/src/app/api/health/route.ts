import { getWebConfig } from '../../../config';
import { buildWebHealth } from '../../../service-health';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const config = getWebConfig();
  return Response.json(buildWebHealth(config.runtime), {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

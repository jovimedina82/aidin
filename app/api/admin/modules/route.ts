import { json } from '@/lib/validation/http';

/**
 * GET /api/admin/modules
 * Returns list of available modules in the system
 */
export async function GET() {
  const modules = [
    'tickets',
    'reports',
    'presence',
    'kb',
    'uploads',
  ];
  
  return json(200, { modules });
}

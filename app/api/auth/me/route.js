import { json, withAuth } from '@/lib/api';

export const GET = withAuth(null, async (_req, _ctx, user) => json({ user }));

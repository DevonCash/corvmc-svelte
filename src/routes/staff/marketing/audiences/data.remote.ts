import { z } from 'zod';
import { query } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import { listAudiences } from '$lib/server/marketing/audience-service';

export const getAudiences = query(z.void(), async () => {
	await requireStaff();
	return listAudiences();
});

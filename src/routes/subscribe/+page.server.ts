import type { PageServerLoad } from './$types';
import { getOptInAudiences } from '$lib/server/marketing/audience-service';

export const load: PageServerLoad = async () => {
	const audiences = await getOptInAudiences();
	return { audiences };
};

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { requireStaffRole } from '$lib/server/authorization';
import { createEquipment } from '$lib/server/equipment/equipment-service';
import { createEquipmentSchema } from '$lib/server/db/schema/equipment';

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireStaffRole(locals.user?.id);
	const body = await request.json();
	const result = createEquipmentSchema.safeParse(body);
	if (!result.success) {
		const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
		return json({ error: message }, { status: 400 });
	}
	const item = await createEquipment(result.data);
	return json({ equipmentId: item.id });
};

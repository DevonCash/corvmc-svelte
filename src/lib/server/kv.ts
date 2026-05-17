let _kv: KVNamespace;

export function initKv(kv: KVNamespace) {
	_kv = kv;
}

function getKv(): KVNamespace {
	if (!_kv) throw new Error('KV not initialized — call initKv() in hooks.server.ts first');
	return _kv;
}

export async function getJson<T>(key: string): Promise<T | null> {
	return getKv().get(key, 'json');
}

export async function putJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	await getKv().put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
}

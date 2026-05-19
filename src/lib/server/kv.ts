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

export async function putJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
	const opts: KVNamespacePutOptions = {};
	if (ttlSeconds) opts.expirationTtl = ttlSeconds;
	await getKv().put(key, JSON.stringify(value), opts);
}

export async function listKeys(prefix: string): Promise<string[]> {
	const result = await getKv().list({ prefix });
	return result.keys.map((k) => k.name);
}

export async function deleteKey(key: string): Promise<void> {
	await getKv().delete(key);
}

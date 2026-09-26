/** IndexedDB store for summoned-leader art (data URLs are far too large for localStorage). */
import type { LeaderArt } from "../types.ts";

const DB = "chronicle";
const STORE = "art";

function open(): Promise<IDBDatabase> {
	return new Promise((res, rej) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE);
		r.onsuccess = () => res(r.result);
		r.onerror = () => rej(r.error);
	});
}

function tx<T>(
	mode: IDBTransactionMode,
	fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	return open().then(
		(db) =>
			new Promise<T>((res, rej) => {
				const req = fn(db.transaction(STORE, mode).objectStore(STORE));
				req.onsuccess = () => res(req.result);
				req.onerror = () => rej(req.error);
			}),
	);
}

export const putArt = (id: string, art: LeaderArt) =>
	tx("readwrite", (s) => s.put(art, id)).then(
		() => true,
		() => false,
	);

export const getArt = (id: string) =>
	tx<LeaderArt | undefined>("readonly", (s) => s.get(id)).catch(
		() => undefined,
	);

export const deleteArt = (id: string) =>
	tx("readwrite", (s) => s.delete(id)).catch(() => undefined);

const DB_NAME = 'nes-saves';
const STORE = 'battery';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function readBattery(key: string): Promise<Uint8Array | null> {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => {
      const value = request.result;
      if (value instanceof Uint8Array) {
        resolve(value);
        return;
      }
      if (value instanceof ArrayBuffer) {
        resolve(new Uint8Array(value));
        return;
      }
      if (ArrayBuffer.isView(value)) {
        resolve(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
        return;
      }
      resolve(null);
    };
    request.onerror = () => reject(request.error);
  }));
}

export function writeBattery(key: string, bytes: Uint8Array): Promise<void> {
  const copy = bytes.slice();
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(copy, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

export function deleteBattery(key: string): Promise<void> {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

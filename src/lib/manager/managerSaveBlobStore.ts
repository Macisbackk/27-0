export interface CareerBlobRecord {
  generationId: string;
  slot: number;
  payload: string;
  checksum: string;
  createdAt: string;
}

export type BlobStoreResult<T> = T | Promise<T>;

export interface CareerBlobStore {
  put(record: CareerBlobRecord): BlobStoreResult<void>;
  get(generationId: string): BlobStoreResult<CareerBlobRecord | null>;
  delete(generationId: string): BlobStoreResult<void>;
  listBySlot(slot: number): BlobStoreResult<CareerBlobRecord[]>;
}

export class MemoryCareerBlobStore implements CareerBlobStore {
  private readonly records = new Map<string, CareerBlobRecord>();

  put(record: CareerBlobRecord): void {
    this.records.set(record.generationId, { ...record });
  }

  get(generationId: string): CareerBlobRecord | null {
    const record = this.records.get(generationId);
    return record ? { ...record } : null;
  }

  delete(generationId: string): void {
    this.records.delete(generationId);
  }

  listBySlot(slot: number): CareerBlobRecord[] {
    return [...this.records.values()]
      .filter((record) => record.slot === slot)
      .map((record) => ({ ...record }));
  }
}

const DATABASE_NAME = "27-0-manager-saves";
const DATABASE_VERSION = 1;
const STORE_NAME = "careers";
const SLOT_INDEX = "slot";

export class IndexedDbCareerBlobStore implements CareerBlobStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.objectStoreNames.contains(STORE_NAME)
          ? request.transaction!.objectStore(STORE_NAME)
          : database.createObjectStore(STORE_NAME, {
              keyPath: "generationId",
            });
        if (!store.indexNames.contains(SLOT_INDEX)) {
          store.createIndex(SLOT_INDEX, "slot", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not open manager save database."));
      request.onblocked = () =>
        reject(new Error("Manager save database upgrade was blocked."));
    });
    return this.databasePromise;
  }

  private async request<T>(
    mode: IDBTransactionMode,
    makeRequest: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const database = await this.openDatabase();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = makeRequest(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Manager save database request failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Manager save transaction aborted."));
    });
  }

  async put(record: CareerBlobRecord): Promise<void> {
    await this.request("readwrite", (store) => store.put(record));
  }

  async get(generationId: string): Promise<CareerBlobRecord | null> {
    const record = await this.request<CareerBlobRecord | undefined>(
      "readonly",
      (store) => store.get(generationId)
    );
    return record ?? null;
  }

  async delete(generationId: string): Promise<void> {
    await this.request("readwrite", (store) => store.delete(generationId));
  }

  async listBySlot(slot: number): Promise<CareerBlobRecord[]> {
    return this.request("readonly", (store) =>
      store.index(SLOT_INDEX).getAll(IDBKeyRange.only(slot))
    );
  }
}

export function createCareerBlobStore(): CareerBlobStore {
  return typeof indexedDB !== "undefined"
    ? new IndexedDbCareerBlobStore()
    : new MemoryCareerBlobStore();
}

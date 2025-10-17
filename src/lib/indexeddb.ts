// IndexedDB wrapper for storing and searching MCP server items

import type { McpServerItem, StackItem } from './types';

export class IndexedDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase | null> | null = null;
  private dbName = 'McpRegistryDB';
  private settingsStore = 'user-settings';
  private serversStore = 'mcp-servers';

  async init() {
    if (typeof window === 'undefined') return null;
    if (this.db) return this.db;
    // If an initialization is already in progress, return that promise so concurrent callers share the same init
    if (this.initPromise) return this.initPromise;

    // Create the initialization promise and store it so other callers can wait on the same promise instead of opening multiple connections
    this.initPromise = new Promise<IDBDatabase | null>((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.settingsStore)) {
            db.createObjectStore(this.settingsStore);
          }
          // Ensure the servers store exists as well so other methods can rely on it
          if (!db.objectStoreNames.contains(this.serversStore)) {
            db.createObjectStore(this.serversStore);
          }
        };
        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          const transaction = this.db.transaction([this.settingsStore], 'readwrite');
          transaction.oncomplete = () => resolve(this.db);
          transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err as unknown);
      }
    });

    // Clear the stored promise once settled so future init() calls can retry
    const p = this.initPromise;
    p.finally(() => {
      // Only clear if the stored promise is the same reference (defensive)
      if (this.initPromise === p) this.initPromise = null;
    });

    try {
      return await p;
    } catch (err) {
      console.warn('IndexedDB initialization failed:', err);
      this.db = null;
      this.initPromise = null;
      return null;
    }
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly') {
    if (!this.db) throw new Error('IndexedDB not initialized');
    const tx = this.db.transaction([storeName], mode);
    return tx.objectStore(storeName) as IDBObjectStore;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      if (!this.db) return null;
      const store = await this.getStore(this.settingsStore, 'readonly');
      return await new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Error reading setting from IndexedDB:', err);
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    try {
      if (!this.db) return;
      const store = await this.getStore(this.settingsStore, 'readwrite');
      return await new Promise((resolve, reject) => {
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Error writing setting to IndexedDB:', err);
      throw err;
    }
  }

  /** Stack-specific helpers */
  async getStack(): Promise<StackItem[]> {
    const saved = await this.get<StackItem[]>('mcp-servers-stack');
    return (saved as StackItem[]) || [];
  }

  async setStack(stack: StackItem[]): Promise<void> {
    await this.set('mcp-servers-stack', stack);
  }

  // NOTE: can use IndexedDB as a basic search store for MCP servers

  /**
   * Initialize servers in IndexedDB.
   * By default this will not re-fetch if the DB already contains servers.
   * Set `forceRefresh` to true to always re-fetch and replace stored servers.
   */
  async initServers(registryUrl: string, forceRefresh = false) {
    // Use the shared init path to ensure DB and stores exist, then fetch and save servers
    if (typeof window === 'undefined') return null;
    try {
      const db = await this.init();
      if (!db) return null;
      // If we already have servers stored and no forced refresh requested, skip fetching
      if (!forceRefresh) {
        const has = await this.hasServers();
        if (has) return this.db;
      }
      // Attempt to fetch servers. On failure, preserve existing DB contents instead of clearing them.
      const docs = await fetchAllServers(registryUrl).catch((err) => {
        console.warn('Failed to fetch servers for initServers:', err);
        return null as McpServerItem[] | null;
      });
      // Fetch failed; don't overwrite existing data. Return the DB connection.
      if (!docs) return this.db;
      // Save using the existing saveServers method which handles clearing and writing
      await this.saveServers(docs || []);
      return this.db;
    } catch (err) {
      console.warn('initServers failed:', err);
      return null;
    }
  }

  async search(term: string): Promise<McpServerItem[]> {
    if (!this.db) return [];
    try {
      const transaction = this.db.transaction([this.serversStore], 'readonly');
      const store = transaction.objectStore(this.serversStore);
      const request = store.openCursor();

      return new Promise((resolve, reject) => {
        const results: McpServerItem[] = [];
        const searchTerm = term.toLowerCase();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const item: McpServerItem = cursor.value;
            if (
              item.server.name.toLowerCase().includes(searchTerm) ||
              item.server.description.toLowerCase().includes(searchTerm)
            ) {
              results.push(item);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('IndexedDB search error:', err);
      return [];
    }
  }

  async hasServers(): Promise<boolean> {
    if (!this.db) return false;
    try {
      return new Promise((resolve) => {
        const transaction = this.db!.transaction([this.serversStore], 'readonly');
        const store = transaction.objectStore(this.serversStore);
        const request = store.count();

        request.onsuccess = () => resolve(request.result > 0);
        request.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn('Error checking if servers exist in IndexedDB:', err);
      return false;
    }
  }

  /** Return all MCP servers in the database */
  async loadServers(): Promise<McpServerItem[]> {
    if (!this.db) return [];
    try {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.serversStore], 'readonly');
        const store = transaction.objectStore(this.serversStore);
        const request = store.getAll();

        request.onsuccess = () => {
          const servers: McpServerItem[] = request.result;
          console.log(`Loaded ${servers.length} servers from IndexedDB`);
          resolve(servers);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('Error loading servers from IndexedDB:', err);
      return [];
    }
  }

  /** Save MCP servers in the database */
  async saveServers(servers: McpServerItem[]): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      if (!this.db) {
        // Initialize DB if not already done
        await this.init();
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.serversStore], 'readwrite');
        const store = transaction.objectStore(this.serversStore);

        // Clear existing data
        store.clear();

        // Add new servers
        servers.forEach((server) => {
          store.put(server, server.server.name);
        });

        transaction.oncomplete = () => {
          console.log(`Saved servers ${servers.length} to IndexedDB`);
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (err) {
      console.warn('Error saving servers to IndexedDB:', err);
      throw err;
    }
  }

  isInitialized(): boolean {
    return this.db !== null;
  }
}

// Export a singleton instance to reuse the DB connection
export const idbSearch = new IndexedDB();

/** Fetch all servers from the API without pagination limits */
const fetchAllServers = async (apiUrl: string): Promise<McpServerItem[]> => {
  const allServers: McpServerItem[] = [];
  let cursor: string | null = null;
  do {
    // Build the API URL with parameters
    const params = ['version=latest', 'limit=100'];
    if (cursor) params.push(`cursor=${encodeURIComponent(cursor)}`);
    let baseUrl = apiUrl;
    if (params.length > 0) {
      baseUrl += `?${params.join('&')}`;
    }
    // Wrap with CORS proxy
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(baseUrl)}`;
    console.log('Fetching all servers URL:', proxyUrl);
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { Accept: 'application/json, application/problem+json' },
      cache: 'force-cache' as const,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    console.log(`Fetched ${data.servers?.length || 0} servers, cursor: ${cursor}`);
    allServers.push(...(data.servers || []));
    cursor = data.metadata?.nextCursor || null;
  } while (cursor);
  console.log(`Total servers fetched: ${allServers.length}`);
  return allServers;
};

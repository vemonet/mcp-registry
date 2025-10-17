// // Orama search experiment

// import { create, insert as oramaInsert, update as oramaUpdate, search as oramaSearch } from '@orama/orama';
// import { persist as persistSnapshot, restore } from '@orama/plugin-data-persistence';

// let db: any = null;
// const STORAGE_KEY = 'mcp-orama-snapshot';

// export async function initOrama() {
//   try {
//     if (typeof window === 'undefined') return null;

//     // Try to restore from a snapshot stored in localStorage
//     const saved = localStorage.getItem(STORAGE_KEY);
//     if (saved) {
//       try {
//         db = await restore('json', saved);
//         return db;
//       } catch (err) {
//         console.warn('Failed to restore Orama from snapshot, creating new DB:', err);
//         db = null;
//       }
//     }

//     // Create new DB instance with schema
//     db = await create({
//       schema: {
//         name: 'string',
//         description: 'string',
//         metadata: 'string',
//         packages: 'string',
//         remotes: 'string',
//         createdAt: 'number',
//         updatedAt: 'number',
//       },
//     });

//     // Persist initial DB snapshot to localStorage
//     try {
//       const snapshot = await persistSnapshot(db, 'json');
//       if (typeof snapshot === 'string') localStorage.setItem(STORAGE_KEY, snapshot);
//     } catch (err) {
//       console.warn('Failed to persist initial Orama snapshot:', err);
//     }

//     return db;
//   } catch (err) {
//     console.warn('Orama initialization failed:', err);
//     db = null;
//     return null;
//   }
// }

// export async function upsertServers(docs: any[]) {
//   if (!docs || docs.length === 0) return;
//   try {
//     if (!db) return;

//     for (const doc of docs) {
//       const id = doc?.server?.name || doc?.id || undefined;

//       const metadata = JSON.stringify(doc.metadata || {});
//       const packages = JSON.stringify((doc.packages || []).map((p: any) => ({
//         name: p.name,
//         identifier: p.identifier,
//         registryType: p.registryType,
//       })));
//       const remotes = JSON.stringify((doc.remotes || []).map((r: any) => ({ url: r.url, name: r.name })));

//       const docToUpsert = {
//         id,
//         name: doc.server?.name || '',
//         description: doc.server?.description || '',
//         metadata,
//         packages,
//         remotes,
//         createdAt: doc.server?.createdAt ? Date.parse(doc.server.createdAt) : 0,
//         updatedAt: doc.server?.updatedAt ? Date.parse(doc.server.updatedAt) : 0,
//       };

//       try {
//         if (id) {
//           await oramaUpdate(db, id, docToUpsert as any);
//         } else {
//           await oramaInsert(db, docToUpsert as any);
//         }
//       } catch (e) {
//         try {
//           await oramaInsert(db, docToUpsert as any);
//         } catch (ee) {
//           console.warn('Orama upsert failed for doc', id, ee);
//         }
//       }
//     }

//     // Persist snapshot to localStorage
//     try {
//       const snapshot = await persistSnapshot(db, 'json');
//       if (typeof snapshot === 'string') localStorage.setItem(STORAGE_KEY, snapshot);
//     } catch (err) {
//       console.warn('Failed to persist Orama snapshot:', err);
//     }
//   } catch (err) {
//     console.warn('Orama upsertServers error:', err);
//   }
// }

// export async function queryOrama(term: string, options?: any) {
//   if (!db) return null;
//   try {
//     const res = await oramaSearch(db, { term, ...options });
//     return res;
//   } catch (err) {
//     console.warn('Orama search error:', err);
//     return null;
//   }
// }

// export async function getOramaDb() {
//   return db;
// }

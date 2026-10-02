// The two storage adapters every module uses for bytes (ARC-6): file storage and client documents.
// Neither has a delete or an overwrite. Modules reach them through this file, never by importing the storage module.

export type FileMeta = { name: string; mimeType: string }
export type StoredFile = { key: string; sha256: string }

/** Where Returns keeps documents, page images, exports and binders: content-addressed and write-once. */
export interface FileStore {
  put(bytes: Uint8Array, meta: FileMeta): Promise<StoredFile>
  get(key: string): Promise<Uint8Array>
  has(key: string): Promise<boolean>
  list(prefix: string): Promise<string[]>
}

export type CorporationRef = { id: string; legalName: string }
export type ClientDocument = {
  driveFileId: string
  name: string
  mimeType: string
  sha256: string
}

/** The firm's Shared Drive of client documents: read-only. */
export interface ClientDocuments {
  listFolder(corporation: CorporationRef, taxYear: number): Promise<ClientDocument[]>
  getFile(driveFileId: string): Promise<ClientDocument & { bytes: Uint8Array }>
}

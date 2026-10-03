// Test credentials for journeys and tests. Imported only from e2e/**, tests and fixtures (SEC-10); never
// exported by index.ts.
import { credentialsFor, TEST_USERS, type TestUser } from './testusers/credentials'

export function listTestUsers(): TestUser[] {
  return TEST_USERS.map((u) => ({ ...u, roles: [...u.roles] }))
}

export function testCredentials(userId: string): { password: string; secret: Uint8Array; codeAt(at: Date): string } {
  return credentialsFor(userId)
}

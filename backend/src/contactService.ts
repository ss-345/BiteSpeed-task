import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from './db';
import { Contact, ConsolidatedContact } from './types';

// ─── 1. Find contacts matching email OR phone ────────────────────────────────
async function findMatchingContacts(
  conn: PoolConnection,
  email: string | null | undefined,
  phoneNumber: string | null | undefined
): Promise<Contact[]> {
  const conditions: string[] = [];
  const params: string[] = [];

  if (email)       { conditions.push('email = ?');       params.push(email); }
  if (phoneNumber) { conditions.push('phoneNumber = ?'); params.push(phoneNumber); }
  if (conditions.length === 0) return [];

  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT * FROM Contact WHERE (${conditions.join(' OR ')}) AND deletedAt IS NULL`,
    params
  );
  return rows as Contact[];
}

// ─── 2. Expand to the full cluster (reuse already-fetched rows) ──────────────
async function getFullCluster(
  conn: PoolConnection,
  contacts: Contact[]
): Promise<Contact[]> {
  if (contacts.length === 0) return [];

  // Collect root primary IDs from the contacts we already have
  const primaryIds = new Set<number>();
  for (const c of contacts) {
    if (c.linkPrecedence === 'primary') primaryIds.add(c.id);
    else if (c.linkedId !== null)       primaryIds.add(c.linkedId);
  }

  // IDs we already fetched — skip re-fetching them
  const alreadyFetchedIds = Array.from(new Set(contacts.map(c => c.id)));

  const idList       = Array.from(primaryIds);
  const idPlaceholders      = idList.map(() => '?').join(',');
  const fetchedPlaceholders = alreadyFetchedIds.map(() => '?').join(',');

  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT * FROM Contact
     WHERE deletedAt IS NULL
       AND (id IN (${idPlaceholders}) OR linkedId IN (${idPlaceholders}))
       AND id NOT IN (${fetchedPlaceholders})`,
    [...idList, ...idList, ...alreadyFetchedIds]
  );

  // Merge already-fetched + newly-fetched
  return [...contacts, ...(rows as Contact[])];
}

// ─── 3. Create a new contact row ─────────────────────────────────────────────
async function createContact(
  conn: PoolConnection,
  email: string | null | undefined,
  phoneNumber: string | null | undefined,
  linkedId: number | null,
  linkPrecedence: 'primary' | 'secondary'
): Promise<Contact> {
  const [result] = await conn.execute<ResultSetHeader>(
    `INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [email || null, phoneNumber || null, linkedId, linkPrecedence]
  );
  const [rows] = await conn.execute<RowDataPacket[]>(
    'SELECT * FROM Contact WHERE id = ?',
    [result.insertId]
  );
  return (rows as Contact[])[0];
}

// ─── 4. Demote a primary to secondary and re-link its children ───────────────
async function demoteToSecondary(
  conn: PoolConnection,
  contactId: number,
  newPrimaryId: number
): Promise<void> {
  // Demote the contact itself
  await conn.execute(
    `UPDATE Contact SET linkPrecedence = 'secondary', linkedId = ?, updatedAt = NOW() WHERE id = ?`,
    [newPrimaryId, contactId]
  );
  // Re-link any contacts that were pointing to the demoted one
  await conn.execute(
    `UPDATE Contact SET linkedId = ?, updatedAt = NOW()
     WHERE linkedId = ? AND deletedAt IS NULL`,
    [newPrimaryId, contactId]
  );
}

// ─── 5. Build the final consolidated response ────────────────────────────────
function buildResponse(allContacts: Contact[]): ConsolidatedContact {
  // True primary = oldest contact with linkPrecedence = 'primary'
  const primaries = allContacts
    .filter(c => c.linkPrecedence === 'primary')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const primary    = primaries[0];
  const secondaries = allContacts.filter(c => c.id !== primary.id);

  // Primary's values come first, then unique values from secondaries
  const emails:       string[] = [];
  const phoneNumbers: string[] = [];

  if (primary.email)       emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

  for (const c of secondaries) {
    if (c.email       && !emails.includes(c.email))             emails.push(c.email);
    if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber)) phoneNumbers.push(c.phoneNumber);
  }

  return {
    primaryContatctId:    primary.id,
    emails,
    phoneNumbers,
    secondaryContactIds: secondaries.map(c => c.id),
  };
}

// ─── Main exported function ───────────────────────────────────────────────────
export async function identifyContact(
  email: string | null | undefined,
  phoneNumber: string | null | undefined
): Promise<ConsolidatedContact> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Step 1 — find directly matching contacts
    const directMatches = await findMatchingContacts(conn, email, phoneNumber);

    // Step 2 — no matches → brand new primary contact
    if (directMatches.length === 0) {
      const newContact = await createContact(conn, email, phoneNumber, null, 'primary');
      await conn.commit();
      return buildResponse([newContact]);
    }

    // Step 3 — expand to full cluster
    let allContacts = await getFullCluster(conn, directMatches);

    // Step 4 — if two separate primaries got linked, demote the newer one
    const primaries = allContacts
      .filter(c => c.linkPrecedence === 'primary')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (primaries.length > 1) {
      const truePrimary = primaries[0];
      for (let i = 1; i < primaries.length; i++) {
        await demoteToSecondary(conn, primaries[i].id, truePrimary.id);
      }
      // Re-fetch the cluster so linkPrecedence values are up to date
      allContacts = await getFullCluster(conn, [truePrimary]);
    }

    // Step 5 — if incoming info is new, create a secondary contact
    const hasEmail = !email       || allContacts.some(c => c.email === email);
    const hasPhone = !phoneNumber || allContacts.some(c => c.phoneNumber === phoneNumber);

    if (!hasEmail || !hasPhone) {
      const truePrimary = allContacts
        .filter(c => c.linkPrecedence === 'primary')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];

      const newSecondary = await createContact(conn, email, phoneNumber, truePrimary.id, 'secondary');
      allContacts.push(newSecondary);
    }

    await conn.commit();
    return buildResponse(allContacts);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

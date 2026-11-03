import { randomUUID } from 'node:crypto';
import { ObjectId, type Db, type Collection } from 'mongodb';
import type {
  Card,
  CardInput,
  CreateDeckInput,
  Deck,
  UpdateDeckInput,
} from '@quibbi/shared';

export class DomainError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface DeckRepository {
  list(
    ownerId: string,
    cursor?: string,
  ): Promise<{ decks: Deck[]; nextCursor: string | null }>;
  get(ownerId: string, id: string): Promise<Deck | null>;
  create(ownerId: string, input: CreateDeckInput): Promise<Deck>;
  update(ownerId: string, id: string, input: UpdateDeckInput): Promise<Deck>;
  delete(ownerId: string, id: string): Promise<boolean>;
}
type StoredDeck = Omit<Deck, 'id'> & { ownerId: string; _id: ObjectId };
export function materializeCards(
  inputs: CardInput[],
  previous: Card[] = [],
): Card[] {
  const byId = new Map(previous.map((card) => [card.id, card]));
  return inputs.map((input) => {
    const old = input.id ? byId.get(input.id) : undefined;
    const alternatives = input.alternatives ?? [];
    const changed =
      !old ||
      old.front !== input.front ||
      old.back !== input.back ||
      JSON.stringify(old.alternatives) !== JSON.stringify(alternatives);
    return {
      id: input.id ?? randomUUID(),
      front: input.front,
      back: input.back,
      alternatives,
      contentVersion: old ? old.contentVersion + Number(changed) : 1,
      // Changing content always invalidates previously approved quiz alternatives.
      alternativesApproved: changed
        ? false
        : Boolean(input.alternativesApproved),
    };
  });
}
function publicDeck(doc: StoredDeck): Deck {
  const { _id, ownerId: _ownerId, ...deck } = doc;
  return { ...deck, id: _id.toHexString() };
}
export class MongoDeckRepository implements DeckRepository {
  private collection: Collection<StoredDeck>;
  constructor(db: Db) {
    this.collection = db.collection<StoredDeck>('decks');
  }
  async ensureIndexes() {
    await this.collection.createIndex({ ownerId: 1, updatedAt: -1, _id: -1 });
  }
  async list(ownerId: string, cursor?: string) {
    let after: { id: string; updatedAt: string } | undefined;
    if (cursor) {
      try {
        const decoded: unknown = JSON.parse(
          Buffer.from(cursor, 'base64url').toString(),
        );
        if (
          !decoded ||
          typeof decoded !== 'object' ||
          !('id' in decoded) ||
          !('updatedAt' in decoded) ||
          typeof decoded.id !== 'string' ||
          !ObjectId.isValid(decoded.id) ||
          typeof decoded.updatedAt !== 'string' ||
          new Date(decoded.updatedAt).toISOString() !== decoded.updatedAt
        )
          throw new Error('Invalid cursor');
        after = { id: decoded.id, updatedAt: decoded.updatedAt };
      } catch {
        throw new DomainError(400, 'VALIDATION_ERROR', 'Invalid page cursor.');
      }
    }
    const found = await this.collection
      .find({
        ownerId,
        ...(after
          ? {
              $or: [
                { updatedAt: { $lt: after.updatedAt } },
                {
                  updatedAt: after.updatedAt,
                  _id: { $lt: new ObjectId(after.id) },
                },
              ],
            }
          : {}),
      })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(31)
      .toArray();
    const last = found[29];
    return {
      decks: found.slice(0, 30).map(publicDeck),
      nextCursor:
        found.length > 30
          ? Buffer.from(
              JSON.stringify({
                id: last._id.toHexString(),
                updatedAt: last.updatedAt,
              }),
            ).toString('base64url')
          : null,
    };
  }
  async get(ownerId: string, id: string) {
    if (!ObjectId.isValid(id)) return null;
    const found = await this.collection.findOne({
      _id: new ObjectId(id),
      ownerId,
    });
    return found ? publicDeck(found) : null;
  }
  async create(ownerId: string, input: CreateDeckInput) {
    const now = new Date().toISOString();
    const doc: StoredDeck = {
      _id: new ObjectId(),
      ownerId,
      title: input.title,
      description: input.description,
      cards: materializeCards(input.cards),
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return publicDeck(doc);
  }
  async update(ownerId: string, id: string, input: UpdateDeckInput) {
    const old = await this.get(ownerId, id);
    if (!old) throw new DomainError(404, 'NOT_FOUND', 'Deck not found.');
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id), ownerId, revision: input.revision },
      {
        $set: {
          title: input.title,
          description: input.description,
          cards: materializeCards(input.cards, old.cards),
          updatedAt: new Date().toISOString(),
        },
        $inc: { revision: 1 },
      },
      { returnDocument: 'after' },
    );
    if (!result)
      throw new DomainError(
        409,
        'REVISION_CONFLICT',
        'This deck changed elsewhere. Reload the saved version before saving again.',
      );
    return publicDeck(result);
  }
  async delete(ownerId: string, id: string) {
    if (!ObjectId.isValid(id)) return false;
    return (
      (await this.collection.deleteOne({ _id: new ObjectId(id), ownerId }))
        .deletedCount === 1
    );
  }
}

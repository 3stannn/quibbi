import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { CreateDeckInput, Deck, UpdateDeckInput } from '@quibbi/shared';
import { createApp } from '../src/app.js';
import { readConfig, safeReturnUrl } from '../src/config.js';
import {
  DomainError,
  materializeCards,
  type DeckRepository,
} from '../src/decks.js';

// In-memory repository is only a test double. Production always uses MongoDB.
class TestRepository implements DeckRepository {
  docs = new Map<string, { owner: string; deck: Deck }>();
  async list(owner: string) {
    return {
      decks: [...this.docs.values()]
        .filter((doc) => doc.owner === owner)
        .map((doc) => doc.deck),
      nextCursor: null,
    };
  }
  async get(owner: string, id: string) {
    const doc = this.docs.get(id);
    return doc?.owner === owner ? doc.deck : null;
  }
  async create(owner: string, input: CreateDeckInput) {
    const deck = {
      ...input,
      id: randomUUID(),
      cards: materializeCards(input.cards),
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.docs.set(deck.id, { owner, deck });
    return deck;
  }
  async update(owner: string, id: string, input: UpdateDeckInput) {
    const old = await this.get(owner, id);
    if (!old) throw new DomainError(404, 'NOT_FOUND', 'Deck not found.');
    if (old.revision !== input.revision)
      throw new DomainError(409, 'REVISION_CONFLICT', 'Reload before saving.');
    const deck = {
      ...old,
      ...input,
      revision: old.revision + 1,
      cards: materializeCards(input.cards, old.cards),
    };
    this.docs.set(id, { owner, deck });
    return deck;
  }
  async delete(owner: string, id: string) {
    if (!(await this.get(owner, id))) return false;
    this.docs.delete(id);
    return true;
  }
}
const origin = 'http://localhost:5173';
function fixture() {
  const repository = new TestRepository();
  const app = createApp({
    config: readConfig({ NODE_ENV: 'test', AUTH_SECRET: 'a'.repeat(32) }),
    repository,
    getUser: async (req) =>
      req.get('x-test-user')
        ? {
            id: req.get('x-test-user')!,
            name: 'Test',
            email: null,
            image: null,
          }
        : null,
    ready: async () => false,
  });
  return { app, repository };
}
async function token(app: ReturnType<typeof fixture>['app'], user = 'alice') {
  return (await request(app).get('/api/session').set('x-test-user', user)).body
    .csrfToken as string;
}
describe('private deck API', () => {
  it('requires a server session and rejects CSRF before mutations', async () => {
    const { app } = fixture();
    expect((await request(app).get('/api/decks')).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/decks')
          .set('x-test-user', 'alice')
          .send({ title: 'Biology' })
      ).status,
    ).toBe(403);
    const csrf = await token(app);
    expect(
      (
        await request(app)
          .post('/api/decks')
          .set('x-test-user', 'alice')
          .set('Origin', 'https://attacker.test')
          .set('x-csrf-token', csrf)
          .send({ title: 'Biology' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/decks')
          .set('x-test-user', 'bob')
          .set('Origin', origin)
          .set('x-csrf-token', csrf)
          .send({ title: 'Biology' })
      ).status,
    ).toBe(403);
  });
  it('creates, reloads, and isolates a deck from another account', async () => {
    const { app } = fixture();
    const csrf = await token(app);
    const created = await request(app)
      .post('/api/decks')
      .set('x-test-user', 'alice')
      .set('Origin', origin)
      .set('x-csrf-token', csrf)
      .send({
        title: 'Cell biology',
        cards: [{ front: 'Cell powerhouse?', back: 'Mitochondrion' }],
      });
    expect(created.status).toBe(201);
    const id = created.body.deck.id;
    expect(
      (await request(app).get(`/api/decks/${id}`).set('x-test-user', 'alice'))
        .body.deck.cards[0].back,
    ).toBe('Mitochondrion');
    expect(
      (await request(app).get(`/api/decks/${id}`).set('x-test-user', 'bob'))
        .status,
    ).toBe(404);
    expect(
      (await request(app).get('/api/decks').set('x-test-user', 'bob')).body
        .decks,
    ).toEqual([]);
    const bobCsrf = await token(app, 'bob');
    expect(
      (
        await request(app)
          .delete(`/api/decks/${id}`)
          .set('x-test-user', 'bob')
          .set('Origin', origin)
          .set('x-csrf-token', bobCsrf)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/decks/${id}`)
          .set('x-test-user', 'bob')
          .set('Origin', origin)
          .set('x-csrf-token', bobCsrf)
          .send({ revision: 1, title: 'Taken', cards: [] })
      ).status,
    ).toBe(404);
  });
  it('rejects malformed non-ASCII CSRF tokens without an internal error', async () => {
    const { app } = fixture();
    const csrf = await token(app);
    // Latin-1 is a valid Node HTTP header character but expands to two UTF-8
    // bytes, reproducing the old equal-string-length/timingSafeEqual mismatch.
    const malformed = `${csrf.slice(0, -1)}é`;
    expect(malformed.length).toBe(csrf.length);
    const response = await request(app)
      .post('/api/decks')
      .set('x-test-user', 'alice')
      .set('Origin', origin)
      .set('x-csrf-token', malformed)
      .send({ title: 'Biology' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_REJECTED');
  });
  it('rejects owner injection, oversized fields, duplicate IDs, and stale drafts', async () => {
    const { app } = fixture();
    const csrf = await token(app);
    const post = (body: unknown) =>
      request(app)
        .post('/api/decks')
        .set('x-test-user', 'alice')
        .set('Origin', origin)
        .set('x-csrf-token', csrf)
        .send(body);
    expect((await post({ title: 'x', ownerId: 'bob' })).status).toBe(400);
    expect((await post({ title: 'x'.repeat(121) })).status).toBe(400);
    const card = { id: randomUUID(), front: 'f', back: 'b' };
    expect((await post({ title: 'x', cards: [card, card] })).status).toBe(400);
    const { deck } = (await post({ title: 'x' })).body;
    const update = () =>
      request(app)
        .patch(`/api/decks/${deck.id}`)
        .set('x-test-user', 'alice')
        .set('Origin', origin)
        .set('x-csrf-token', csrf)
        .send({ title: 'Updated', revision: 1, cards: [] });
    expect((await update()).status).toBe(200);
    expect((await update()).status).toBe(409);
  });
  it('does not fabricate readiness or a user when configuration is missing', async () => {
    const { app } = fixture();
    expect((await request(app).get('/api/health')).status).toBe(503);
    expect((await request(app).get('/api/session')).body).toEqual({
      user: null,
      configured: false,
    });
    expect((await request(app).get('/auth/csrf')).status).toBe(503);
  });
});
describe('content versions and redirect validation', () => {
  it('preserves version on reorder, invalidates approval on edit', () => {
    const first = materializeCards([
      {
        front: 'Q',
        back: 'A',
        alternatives: ['B', 'C', 'D'],
        alternativesApproved: true,
      },
    ])[0];
    expect(first.alternativesApproved).toBe(false);
    const approved = { ...first, alternativesApproved: true };
    expect(materializeCards([approved], [approved])[0].contentVersion).toBe(1);
    const changed = materializeCards(
      [{ ...approved, back: 'New answer' }],
      [approved],
    )[0];
    expect(changed.contentVersion).toBe(2);
    expect(changed.alternativesApproved).toBe(false);
  });
  it('keeps local invitations and rejects external or unsafe callback targets', () => {
    expect(safeReturnUrl('/s/token', origin)).toBe(`${origin}/s/token`);
    for (const target of [
      '//evil.test/s/x',
      'https://evil.test/library',
      'javascript:alert(1)',
      '/auth/signout',
      '/\\evil.test/s/x',
    ])
      expect(safeReturnUrl(target, origin)).toBe(`${origin}/library`);
  });
  it('requires HTTPS and complete secrets in production', () => {
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow('HTTPS');
    expect(() =>
      readConfig({ NODE_ENV: 'production', APP_ORIGIN: 'https://quibbi.test' }),
    ).toThrow('Production requires');
  });
});

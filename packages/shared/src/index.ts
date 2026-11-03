import { z } from 'zod';

export const cardInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    front: z.string().max(2000),
    back: z.string().max(2000),
    alternatives: z
      .array(z.string().trim().min(1).max(2000))
      .max(3)
      .default([]),
    alternativesApproved: z.boolean().default(false),
  })
  .strict();
const deckFields = {
  title: z.string().trim().min(1, 'Give your deck a title.').max(120),
  description: z.string().max(1000).default(''),
  cards: z.array(cardInputSchema).max(200).default([]),
};
function uniqueCards(value: { cards: { id?: string }[] }) {
  const ids = value.cards.flatMap((card) => (card.id ? [card.id] : []));
  return new Set(ids).size === ids.length;
}
export const createDeckSchema = z
  .object(deckFields)
  .strict()
  .refine(uniqueCards, 'Card IDs must be unique.');
export const updateDeckSchema = z
  .object({ ...deckFields, revision: z.number().int().positive() })
  .strict()
  .refine(uniqueCards, 'Card IDs must be unique.');
export type CardInput = z.infer<typeof cardInputSchema>;
export type CreateDeckInput = z.infer<typeof createDeckSchema>;
export type UpdateDeckInput = z.infer<typeof updateDeckSchema>;
export type Card = Omit<CardInput, 'id'> & {
  id: string;
  contentVersion: number;
};
export type Deck = {
  id: string;
  title: string;
  description: string;
  revision: number;
  cards: Card[];
  createdAt: string;
  updatedAt: string;
};
export type PublicUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};
export type SessionResponse = {
  user: PublicUser | null;
  configured: boolean;
  csrfToken?: string;
};
export type ApiError = {
  error: { code: string; message: string; issues?: unknown };
};

import { ExpressAuth, getSession, type ExpressAuthConfig } from '@auth/express';
import Google from '@auth/express/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { readConfig, isConfigured, safeReturnUrl } from './config.js';
import { MongoDeckRepository } from './decks.js';

const config = readConfig();
// Auth.js uses AUTH_URL when building internal session/action URLs. Pin it to
// the validated deployment origin rather than trusting forwarded host headers.
process.env.AUTH_URL = `${config.APP_ORIGIN}/auth`;
let client: MongoClient | undefined;
let repository: MongoDeckRepository | undefined;
let authConfig: ExpressAuthConfig | undefined;
if (isConfigured(config)) {
  client = new MongoClient(config.MONGODB_URI!, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  const db = client.db(config.MONGODB_DB);
  repository = new MongoDeckRepository(db);
  await repository.ensureIndexes();
  await db
    .collection('sessions')
    .createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
  authConfig = {
    basePath: '/auth',
    secret: config.AUTH_SECRET,
    trustHost: true,
    adapter: MongoDBAdapter(client, { databaseName: config.MONGODB_DB }),
    providers: [
      Google({
        clientId: config.AUTH_GOOGLE_ID,
        clientSecret: config.AUTH_GOOGLE_SECRET,
      }),
    ],
    session: {
      strategy: 'database',
      maxAge: 30 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    useSecureCookies: config.NODE_ENV === 'production',
    pages: { signIn: '/login', error: '/login' },
    callbacks: {
      async redirect({ url }) {
        return safeReturnUrl(url, config.APP_ORIGIN);
      },
      async session({ session, user }) {
        return { ...session, user: { ...session.user, id: user.id } };
      },
    },
  };
} else
  console.info(
    'Setup required: configure root .env with MongoDB and Google OAuth credentials.',
  );
const app = createApp({
  config,
  repository,
  authHandler: authConfig ? ExpressAuth(authConfig) : undefined,
  getUser: async (req) => {
    if (!authConfig) return null;
    const session = await getSession(req, authConfig);
    if (!session?.user?.id || new Date(session.expires).getTime() <= Date.now())
      return null;
    return {
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      image: session.user.image ?? null,
    };
  },
  ready: async () => {
    if (!client || !authConfig) return false;
    await client.db(config.MONGODB_DB).command({ ping: 1 });
    return true;
  },
  staticPath:
    config.NODE_ENV === 'production'
      ? fileURLToPath(new URL('../../web/dist', import.meta.url))
      : undefined,
});
const server = app.listen(config.PORT, () =>
  console.info(`Quibbi API listening on port ${config.PORT}`),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    server.close(() => {
      void client?.close().finally(() => process.exit(0));
      if (!client) process.exit(0);
    });
  });

import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
} from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  createDeckSchema,
  updateDeckSchema,
  type PublicUser,
} from '@quibbi/shared';
import { DomainError, type DeckRepository } from './decks.js';
import type { Config } from './config.js';

export type AppDependencies = {
  config: Config;
  repository?: DeckRepository;
  authHandler?: RequestHandler;
  getUser: (req: Request) => Promise<PublicUser | null>;
  ready: () => Promise<boolean>;
  staticPath?: string;
};
const asyncRoute =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
export function csrfToken(
  userId: string,
  secret: string,
  expires = Date.now() + 3_600_000,
) {
  return `${expires}.${createHmac('sha256', secret).update(`${userId}:${expires}`).digest('hex')}`;
}
function validCsrf(token: string, userId: string, secret: string) {
  if (!/^\d+\.[a-f0-9]{64}$/.test(token)) return false;
  const [expiry] = token.split('.');
  const time = Number(expiry);
  if (
    !Number.isSafeInteger(time) ||
    time < Date.now() ||
    time > Date.now() + 3_600_000
  )
    return false;
  const expected = Buffer.from(csrfToken(userId, secret, time));
  const received = Buffer.from(token);
  return (
    received.byteLength === expected.byteLength &&
    timingSafeEqual(received, expected)
  );
}
export function createApp(deps: AppDependencies) {
  const app = express();
  const { config } = deps;
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(
    helmet({
      contentSecurityPolicy:
        config.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get(
    '/api/health',
    asyncRoute(async (_req, res) => {
      const ready = await deps.ready().catch(() => false);
      res.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'setup-required',
        configured: Boolean(deps.repository && deps.authHandler),
      });
    }),
  );
  app.use('/auth', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const hostGuard: RequestHandler = (req, _res, next) => {
    if (req.get('host') !== new URL(config.APP_ORIGIN).host)
      return next(
        new DomainError(
          400,
          'INVALID_HOST',
          'Use the configured application origin.',
        ),
      );
    // Provider redirects must never derive their host from arbitrary forwarding
    // headers. The configured origin is canonical, including behind a proxy.
    req.headers['x-forwarded-host'] = new URL(config.APP_ORIGIN).host;
    req.headers['x-forwarded-proto'] = new URL(
      config.APP_ORIGIN,
    ).protocol.slice(0, -1);
    next();
  };
  if (deps.authHandler)
    app.use(
      '/auth/*',
      hostGuard,
      rateLimit({
        windowMs: 60_000,
        limit: 40,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
      }),
      deps.authHandler,
    );
  else
    app.use('/auth', (_req, res) =>
      res.status(503).json({
        error: {
          code: 'SETUP_REQUIRED',
          message:
            'Google sign-in is not configured. Complete the server environment setup.',
        },
      }),
    );
  app.use(express.json({ limit: '3mb' }));
  app.get(
    '/api/session',
    asyncRoute(async (req, res) => {
      const user = await deps.getUser(req);
      res.json({
        user,
        configured: Boolean(deps.repository && deps.authHandler),
        ...(user && config.AUTH_SECRET
          ? { csrfToken: csrfToken(user.id, config.AUTH_SECRET) }
          : {}),
      });
    }),
  );
  app.use(
    '/api/decks',
    asyncRoute(async (req, res, next) => {
      const user = await deps.getUser(req);
      if (!user)
        throw new DomainError(
          401,
          'UNAUTHENTICATED',
          'Sign in to open your library.',
        );
      res.locals.user = user;
      if (!deps.repository || !config.AUTH_SECRET)
        throw new DomainError(
          503,
          'SETUP_REQUIRED',
          'Database configuration is incomplete.',
        );
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const token = req.get('x-csrf-token') ?? '';
        if (
          req.get('origin') !== config.APP_ORIGIN ||
          !validCsrf(token, user.id, config.AUTH_SECRET)
        )
          throw new DomainError(
            403,
            'CSRF_REJECTED',
            'Refresh your session and try again.',
          );
      }
      next();
    }),
  );
  app.use(
    '/api/decks',
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Wait a minute and try again.',
          },
        }),
    }),
  );
  app.get(
    '/api/decks',
    asyncRoute(async (req, res) => {
      if (
        req.query.cursor !== undefined &&
        typeof req.query.cursor !== 'string'
      )
        throw new DomainError(400, 'VALIDATION_ERROR', 'Invalid page cursor.');
      res.json(
        await deps.repository!.list(
          res.locals.user.id,
          req.query.cursor as string | undefined,
        ),
      );
    }),
  );
  app.post(
    '/api/decks',
    asyncRoute(async (req, res) => {
      const input = createDeckSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Check your deck fields.',
            issues: input.error.flatten(),
          },
        });
        return;
      }
      res.status(201).json({
        deck: await deps.repository!.create(res.locals.user.id, input.data),
      });
    }),
  );
  app.get(
    '/api/decks/:id',
    asyncRoute(async (req, res) => {
      const deck = await deps.repository!.get(
        res.locals.user.id,
        req.params.id,
      );
      if (!deck) throw new DomainError(404, 'NOT_FOUND', 'Deck not found.');
      res.json({ deck });
    }),
  );
  app.patch(
    '/api/decks/:id',
    asyncRoute(async (req, res) => {
      const input = updateDeckSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Check your deck fields.',
            issues: input.error.flatten(),
          },
        });
        return;
      }
      res.json({
        deck: await deps.repository!.update(
          res.locals.user.id,
          req.params.id,
          input.data,
        ),
      });
    }),
  );
  app.delete(
    '/api/decks/:id',
    asyncRoute(async (req, res) => {
      if (!(await deps.repository!.delete(res.locals.user.id, req.params.id)))
        throw new DomainError(404, 'NOT_FOUND', 'Deck not found.');
      res.status(204).end();
    }),
  );
  app.use('/api', (_req, res) =>
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Resource not found.' } }),
  );
  if (deps.staticPath && existsSync(deps.staticPath)) {
    app.use(express.static(deps.staticPath, { index: false }));
    app.get('*', (_req, res) =>
      res.sendFile('index.html', { root: deps.staticPath! }),
    );
  }
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof DomainError) {
      res
        .status(error.status)
        .json({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'The deck exceeds the request size limit.',
        },
      });
      return;
    }
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'Invalid JSON request.' },
      });
      return;
    }
    // Do not log requests or URLs: future invitation URLs contain bearer tokens.
    console.error(
      'Request failed:',
      error instanceof Error ? error.name : 'UnknownError',
    );
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The request failed. Try again.',
      },
    });
  };
  app.use(errorHandler);
  return app;
}

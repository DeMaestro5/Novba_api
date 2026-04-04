import express, { Request, Response, NextFunction } from 'express';
import Logger from './core/Logger';
import cors from 'cors';
import { corsUrl, environment } from './config';
import './database'; // initialize database
import {
  NotFoundError,
  ApiError,
  InternalError,
  ErrorType,
} from './core/ApiError';
import routes from './routes';

process.on('uncaughtException', (e) => {
  Logger.error(e);
});

const app = express();

app.set('trust proxy', 1);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() }),
);

// Stripe webhooks MUST receive raw body — mount before express.json()
app.use(
  '/webhooks',
  express.raw({ type: 'application/json' }),
);

// All other routes get parsed JSON
app.use((req, _res, next) => {
  if (req.path.startsWith('/webhooks')) return next();
  express.json({ limit: '10mb' })(req, _res, next);
});
app.use((req, _res, next) => {
  if (req.path.startsWith('/webhooks')) return next();
  express.urlencoded({ limit: '10mb', extended: true, parameterLimit: 50000 })(req, _res, next);
});
const allowedOrigins = [
  corsUrl,
  'http://localhost:3000',
  'https://www.usenovba.com',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

// Routes
app.use('/', routes);

// catch 404 and forward to error handler
app.use((req, res, next) => next(new NotFoundError()));

// Middleware Error Handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    ApiError.handle(err, res);
    if (err.type === ErrorType.INTERNAL)
      Logger.error(
        `500 - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`,
      );
  } else {
    Logger.error(
      `500 - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`,
    );
    Logger.error(err);
    if (environment === 'development') {
      return res.status(500).send(err);
    }
    ApiError.handle(new InternalError(), res);
  }
});

export default app;

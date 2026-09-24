// Augment Express types for cleaner route handlers
import { AuthenticatedUser } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};

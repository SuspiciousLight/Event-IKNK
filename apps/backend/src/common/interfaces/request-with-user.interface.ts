import { Request } from 'express';
import { AuthenticatedUser } from '../types/authenticated-user.type';

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
  requestId?: string;
}
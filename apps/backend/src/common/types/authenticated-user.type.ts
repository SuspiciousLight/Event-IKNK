import { Role } from '../constants/role.enum';

export type AuthenticatedUser = {
  userId: string;
  role: Role;
  adminId?: string;
};
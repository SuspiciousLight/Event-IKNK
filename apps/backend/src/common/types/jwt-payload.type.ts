import { Role } from '../constants/role.enum';

export type JwtPayload = {
  sub: string;
  role: Role;
  adminId?: string;
};
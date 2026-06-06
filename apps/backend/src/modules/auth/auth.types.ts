import { Role } from '../../common/constants/role.enum';

export type AuthResponseDto = {
  userId: string;
  adminId?: string;
  role: Role;
};
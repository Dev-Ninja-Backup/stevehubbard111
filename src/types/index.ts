export interface IUserRole {
  id: number;
  name: string;     // or string if you prefer
  createdAt: Date;// ISO string
  updatedAt: Date; // ISO string
}
// 
export interface IUser {
  id: number;
  email: string;
  name: string;
  status: string;
  roleId: number;
  role?: {
    id: number;
    name: string;
  };
}
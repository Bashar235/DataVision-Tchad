// Sample user data for mock authentication
export interface User {
  username: string;
  password: string;
  role: 'admin' | 'analyst' | 'researcher';
}

export const users: User[] = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'analyst', password: 'analyst123', role: 'analyst' },
  { username: 'researcher', password: 'researcher123', role: 'researcher' },
];

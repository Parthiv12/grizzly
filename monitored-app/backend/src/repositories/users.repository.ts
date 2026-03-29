import { randomUUID } from 'crypto';
import { withBusinessSpan } from '../observability/span-utils';
import type { User, RequestTraceMeta } from '../types/users';

class UsersRepository {
  private db: User[] = [
    {
      id: randomUUID(),
      name: 'Admin User',
      email: 'admin@tracelens.com',
      password_hash: 'admin123',
      created_at: new Date().toISOString()
    }
  ];

  async insert(user: Omit<User, 'id' | 'created_at'>, meta: RequestTraceMeta): Promise<User> {
    return withBusinessSpan('users_repository_insert', {
      layer: 'database',
      resource: 'users_db',
      operation: 'insert',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      // simulate db insert time
      await new Promise(r => setTimeout(r, 45));

      const newUser: User = {
        ...user,
        id: randomUUID(),
        created_at: new Date().toISOString()
      };
      
      this.db.push(newUser);
      return newUser;
    });
  }

  async findByEmail(email: string, meta: RequestTraceMeta): Promise<User | undefined> {
    return withBusinessSpan('users_repository_findByEmail', {
      layer: 'database',
      resource: 'users_db',
      operation: 'find',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      // INTENTIONAL SLOWDOWN IF LOGIN (to simulate the exact requested 2500ms slowdown)
      if (meta.httpRoute.includes('/login')) {
         await new Promise(r => setTimeout(r, 2500));
      } else {
         await new Promise(r => setTimeout(r, 30));
      }

      return this.db.find(u => u.email === email);
    });
  }

  async findAll(meta: RequestTraceMeta): Promise<User[]> {
    return withBusinessSpan('users_repository_findAll', {
      layer: 'database',
      resource: 'users_db',
      operation: 'find_all',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      await new Promise(r => setTimeout(r, 50));
      // INTENTIONAL N+1 PROBLEM WILL HAPPEN IN SERVICE
      return [...this.db];
    });
  }
  
  // N+1 query simulation
  async getUserRole(userId: string, meta: RequestTraceMeta): Promise<string> {
    return withBusinessSpan('users_repository_findRole', {
      layer: 'database',
      resource: 'users_db',
      operation: 'find_role',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      await new Promise(r => setTimeout(r, 15));
      return userId === this.db[0].id ? 'admin' : 'user';
    });
  }
}

export const usersRepository = new UsersRepository();

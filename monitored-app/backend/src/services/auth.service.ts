import { withBusinessSpan } from '../observability/span-utils';
import { usersRepository } from '../repositories/users.repository';
import { emailService } from './email.service';
import type { RequestTraceMeta, User } from '../types/users';

export class AuthService {
  async registerUser(body: any, meta: RequestTraceMeta): Promise<User> {
    return withBusinessSpan('register_user', {
      layer: 'service',
      resource: 'auth',
      operation: 'register',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      if (!body.email || !body.password) {
        throw new Error('Email and password required');
      }

      const existing = await usersRepository.findByEmail(body.email, meta);
      if (existing) {
        throw new Error('Email already taken');
      }

      // 1. Simulate Hash
      await withBusinessSpan('hash_password', {
        layer: 'service',
        resource: 'auth',
        operation: 'hash'
      }, async () => {
        await new Promise(r => setTimeout(r, 60)); // cpu work
      });

      // 2. Insert into DB
      const user = await usersRepository.insert({
        name: body.name || 'Unknown',
        email: body.email,
        password_hash: body.password // fake hashed
      }, meta);

      // 3. Trigger Email Hook (might fail if newsletter is true)
      await emailService.sendWelcomeEmail(user, body.subscribeToNewsletter === true, meta);

      return user;
    });
  }

  async loginUser(body: any, meta: RequestTraceMeta): Promise<User & { token: string }> {
    return withBusinessSpan('login_user', {
      layer: 'service',
      resource: 'auth',
      operation: 'login',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      // 1. Database operation with 2.5sec artificial latency inside repository
      const user = await usersRepository.findByEmail(body.email, meta);

      if (!user || user.password_hash !== body.password) {
        throw new Error('Invalid credentials');
      }

      // Return auth token
      return { ...user, token: "JWT.MOCK.TOKEN" };
    });
  }

  async getUsers(meta: RequestTraceMeta): Promise<any[]> {
    return withBusinessSpan('get_users', {
      layer: 'service',
      resource: 'users',
      operation: 'find',
      httpMethod: meta.httpMethod,
      httpRoute: meta.httpRoute
    }, async () => {
      // fetch base users
      const usersList = await usersRepository.findAll(meta);

      // INTENTIONAL N+1 QUERY SCENARIO
      // 10 users -> 10 serial rapid DB queries perfectly clustered
      const enrichedUsers = [];
      for (const u of usersList) {
         const role = await usersRepository.getUserRole(u.id, meta);
         enrichedUsers.push({ ...u, role });
      }

      return enrichedUsers;
    });
  }
}

export const authService = new AuthService();

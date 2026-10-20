import { createUser, signToken } from '../../src/services/auth.service.js';

let counter = 0;

/** @param {'analyst' | 'viewer'} role */
export async function userWithToken(role) {
  counter += 1;
  const user = await createUser({
    email: `${role}${counter}@test.dev`,
    password: 'password123',
    name: `${role} ${counter}`,
    role,
  });
  return { user, token: signToken(user), header: { Authorization: `Bearer ${signToken(user)}` } };
}

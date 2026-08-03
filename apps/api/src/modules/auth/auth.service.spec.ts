import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userService: { findByEmail: jest.Mock; create: jest.Mock };
  let jwtService: { sign: jest.Mock };

  const fakeUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'u-1',
      username: 'tester',
      email: 'a@b.com',
      role: 'user',
      ...overrides,
    }) as User;

  beforeEach(() => {
    userService = { findByEmail: jest.fn(), create: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('signed-token') };
    service = new AuthService(userService as never, jwtService as never);
  });

  describe('register', () => {
    const dto = { username: 'tester', email: 'a@b.com', password: 'secret123' };

    it('邮箱已注册时抛出 ConflictException', async () => {
      userService.findByEmail.mockResolvedValue(fakeUser());

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(userService.create).not.toHaveBeenCalled();
    });

    it('注册成功：密码哈希落库，返回 token 与脱敏用户', async () => {
      userService.findByEmail.mockResolvedValue(null);
      userService.create.mockImplementation(async (input: {
        username: string;
        email: string;
        passwordHash: string;
      }) => {
        // 哈希不应等于明文，且能通过校验
        expect(input.passwordHash).not.toBe(dto.password);
        return fakeUser({ passwordHash: input.passwordHash });
      });

      const result = await service.register(dto);

      expect(result.accessToken).toBe('signed-token');
      expect(result.user).toEqual({
        id: 'u-1',
        username: 'tester',
        email: 'a@b.com',
        role: 'user',
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'u-1',
        email: 'a@b.com',
        role: 'user',
      });
    });
  });

  describe('login', () => {
    it('邮箱不存在时抛出 UnauthorizedException', async () => {
      userService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'x@y.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('密码错误时抛出 UnauthorizedException', async () => {
      // 用一个真实哈希保证 compare 走到密码校验分支
      const { hash } = await import('bcryptjs');
      const passwordHash = await hash('correct-password', 10);
      userService.findByEmail.mockResolvedValue(fakeUser({ passwordHash }));

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('登录成功返回 token 与脱敏用户', async () => {
      const { hash } = await import('bcryptjs');
      const passwordHash = await hash('correct-password', 10);
      userService.findByEmail.mockResolvedValue(fakeUser({ passwordHash }));

      const result = await service.login({
        email: 'a@b.com',
        password: 'correct-password',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });
});

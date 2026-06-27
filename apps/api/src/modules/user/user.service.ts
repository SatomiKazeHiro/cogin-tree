import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserProfile } from './entities/user-profile.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserProfile)
    private profileRepo: Repository<UserProfile>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find();
  }

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
  }): Promise<User> {
    const user = this.userRepo.create(data);
    const saved = await this.userRepo.save(user);

    const profile = this.profileRepo.create({
      userId: saved.id,
    });
    await this.profileRepo.save(profile);

    return saved;
  }

  async update(
    id: string,
    data: Partial<Pick<User, 'username' | 'email' | 'avatar' | 'role' | 'passwordHash'>>,
  ): Promise<User | null> {
    await this.userRepo.update(id, data);
    return this.findById(id);
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    return this.profileRepo.findOne({ where: { userId } });
  }

  async updateProfile(
    userId: string,
    data: Partial<UserProfile>,
  ): Promise<UserProfile> {
    let profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      profile = this.profileRepo.create({ userId, ...data });
    } else {
      Object.assign(profile, data);
    }
    return this.profileRepo.save(profile);
  }
}

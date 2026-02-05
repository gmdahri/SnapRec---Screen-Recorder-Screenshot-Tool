import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
export declare class UsersService {
    private readonly usersRepository;
    private readonly logger;
    constructor(usersRepository: Repository<User>);
    findOrCreateBySupabaseId(supabaseId: string, email?: string): Promise<User>;
    findBySupabaseId(supabaseId: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
}

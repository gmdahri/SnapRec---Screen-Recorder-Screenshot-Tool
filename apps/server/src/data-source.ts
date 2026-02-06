import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './users/entities/user.entity';
import { Recording } from './recordings/entities/recording.entity';
import { Reaction } from './recordings/entities/reaction.entity';
import { Comment } from './recordings/entities/comment.entity';

dotenv.config();

export default new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [User, Recording, Reaction, Comment],
    migrations: ['src/migrations/*.ts'],
    ssl: {
        rejectUnauthorized: false, // Required for Supabase
    },
});

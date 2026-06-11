import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * TypeORM CLI DataSource — used for migrations (generate / run / revert).
 * Mirrors the runtime config in config/typeorm.config.ts (synchronize:false).
 * SCHEMA.sql remains the baseline for a fresh DB (`npm run db:init`);
 * incremental changes go through migrations in src/migrations.
 */
export default new DataSource({
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'sheetmetal',
      }),
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * The schema is created from ../SCHEMA.sql (run `npm run db:init`).
 * TypeORM runs with synchronize:false — entities map onto the existing tables.
 */
export function typeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  const url = config.get<string>('DATABASE_URL');
  return {
    type: 'postgres',
    ...(url
      ? { url }
      : {
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get<string>('DB_USER', 'postgres'),
          password: config.get<string>('DB_PASSWORD', 'postgres'),
          database: config.get<string>('DB_NAME', 'sheetmetal'),
        }),
    autoLoadEntities: true,
    synchronize: false,
    namingStrategy: undefined, // entities declare explicit column names matching SCHEMA.sql
  };
}

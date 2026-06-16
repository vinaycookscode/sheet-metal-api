import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

/**
 * Task Inbox — a role-aware "what needs me now" feed assembled from existing
 * records (no tables of its own). Reads via the injected DataSource's repositories.
 */
@Module({
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}

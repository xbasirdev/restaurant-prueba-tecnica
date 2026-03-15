import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { validateEnv } from './shared/config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    InfrastructureModule,
    ...(process.env.NODE_ENV === 'test' ? [] : [MenuModule]),
    ...(process.env.NODE_ENV === 'test' ? [] : [OrdersModule]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

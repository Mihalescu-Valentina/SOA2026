import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Transaction } from './transaction.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [Transaction],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Transaction]),
    ClientsModule.register([
      {
        name: 'LISTING_SERVICE',
        transport: Transport.RMQ,
        options: {
          // Connect to the RabbitMQ container
          urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672'],
          // Send messages to the queue that Listing Service is listening to
          queue: 'orders_queue',
          queueOptions: {
            durable: false,
          },
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

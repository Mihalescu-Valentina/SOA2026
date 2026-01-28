import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { Listing } from './entities/listing.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { ListingsGateway } from './listings.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing]),
    PassportModule,
    // Register the RabbitMQ Client to SEND messages
    ClientsModule.register([
      {
        name: 'TRANSACTION_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672'],
          queue: 'transactions_queue',
          queueOptions: {
            durable: false,
          },
        },
      },
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
          },
          consumer: {
            groupId: 'listing-producer',
          },
        },
      },
    ]),
  ],
  controllers: [ListingsController],
  providers: [ListingsService, JwtStrategy, ListingsGateway],
})
export class ListingsModule { }

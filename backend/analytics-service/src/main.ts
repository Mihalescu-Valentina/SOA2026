import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKER || 'localhost:9092'], // Connects to the Docker container name
      },
      consumer: {
        groupId: 'analytics-consumer', // Unique ID for this service
      },
    },
  });

  await app.listen();
  console.log('📊 Analytics Service is listening to Kafka...');
}
bootstrap();

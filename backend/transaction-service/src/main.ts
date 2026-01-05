// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 3000);
// }
// bootstrap();

import { NestFactory } from '@nestjs/core'; 
import { AppModule } from './app.module'; 
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() { 
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.connectMicroservice<MicroserviceOptions>({ transport: Transport.RMQ, options: { urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'], queue: 'transactions_queue', queueOptions: { durable: false, }, }, });

  await app.startAllMicroservices(); await app.listen(3002); console.log('Transaction Service is listening on Port 3002 and RabbitMQ!'); 
} 
bootstrap();

import { Controller,Get, Param } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @EventPattern('order_created')
  handleOrderCreated(@Payload() data: any) {
    console.log('📝 Saving Transaction:', data);
    this.appService.createTransaction(data);
  }

  @Get('/api/transactions')
  getTransactions() {
    return this.appService.findAllTransactions();
  }

  @Get('/api/transactions/user/:userId') // Endpoint expects an ID
  getUserTransactions(@Param('userId') userId: string) {
  return this.appService.findUserTransactions(+userId);
}
}
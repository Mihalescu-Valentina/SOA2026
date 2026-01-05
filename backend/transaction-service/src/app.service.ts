import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transaction.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
  ) {}

  async createTransaction(data: any) {
    await this.transactionRepo.save(data);
    console.log('✅ Transaction Saved to Database!');
  }
  
  getHello(): string {
    return 'Transaction Service OK';
  }

  async findAllTransactions() {
  return this.transactionRepo.find();
  }

  async findUserTransactions(userId: number) {
  return this.transactionRepo.find({
    where: [
      { buyerId: userId },   // Case A: I bought it
      { sellerId: userId }   // Case B: I sold it
    ]
  });
}
}
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transaction.entity';
import axios from 'axios'; // <--- Import Axios
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepo: Repository<Transaction>,
    @Inject('LISTING_SERVICE') private readonly client: ClientProxy,
  ) { }

  async createTransaction(data: any) {
    console.log('📦 RabbitMQ Event Received:', data);

    let finalPrice = data.price;
    let fee = 0;

    // --- CALL AWS LAMBDA (FaaS) ---
    try {
      console.log('☁️ Calling AWS Lambda for Fee Calculation...');
      const awsResponse = await axios.post(
        "https://lpcpvau2hkga3w7untpo2j5wia0flewb.lambda-url.eu-west-1.on.aws/",
        { price: data.price }
      );

      fee = awsResponse.data.fee;
      finalPrice = awsResponse.data.total;
      console.log(`✅ FaaS Response: Fee is $${fee}, Total is $${finalPrice}`);
    } catch (error) {
      console.error('❌ AWS Lambda Failed, using default price', error.message);
    }
    // ------------------------------

    // Save the transaction with the new Fee info
    const transaction = this.transactionRepo.create({
      listingId: data.listingId,
      sellerId: data.sellerId,
      buyerId: data.buyerId,
      price: finalPrice, // We save the Total (Price + Fee)
      createdAt: new Date(),
    });
    const savedTransaction = await this.transactionRepo.save(transaction);

    console.log(`📢 Emitting 'item_sold' confirmation for Listing #${data.listingId}`);

    this.client.emit('item_sold', {
      listingId: data.listingId,
      buyerId: data.buyerId,
      transactionId: savedTransaction.id
    });

    return savedTransaction;
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

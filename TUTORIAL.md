---

# Tutorial: Asynchronous Microservices with RabbitMQ in NestJS

* **Project:** MicroStore (Distributed E-Commerce System)
* **Focus:** Message Brokers, Event-Driven Architecture, and Decoupling

---

## 1. Introduction to RabbitMQ

In a monolithic application, components talk to each other directly (like function calls).
In a distributed system, services must communicate efficiently without blocking the user. A common pitfall is Tight Coupling, where Service A waits for Service B to finish before responding to the user.
In this tutorial I will show how I solved this problem via RabbitMQ using the buy item functionality as example. 

**RabbitMQ** is a **Message Broker**. We can say it's similar to a **Digital Post Office**:

1. **Producer (Sender):** Writes a letter (data), puts it in an envelope, and drops it in a mailbox. It doesn't care *who* delivers it or *when*. It just trusts it will get there.
2. **Queue (Mailbox):** A buffer where messages sit until they can be processed.
3. **Consumer (Receiver):** The mailman who picks up the letter, opens it, and does the actual work.

### Why use RabbitMQ instead of HTTP?

* **Decoupling:** If the Transaction Service is down or slow, the Listing Service doesn't crash. It just drops the message in the queue and moves on.
* **Performance:** The user gets an immediate response, while the heavy lifting (creating records, calculating taxes via FaaS) happens in the background.
* **Reliability:** Messages persist in the queue until they are successfully processed.

---

## 2. Applied Architecture: The "Buy Item" Flow

In **MicroStore**, we use RabbitMQ to handle the critical "Purchase" workflow.

### The Challenge

When a user clicks "Buy", two things must happen:

1. **Listing Service:** Must mark the item as "Sold" so no one else buys it.
2. **Transaction Service:** Must create a transaction record, which involves calling an external **AWS Lambda (FaaS)** function to calculate fees.

If we did this synchronously (HTTP), the user would have to wait for the Database, RabbitMQ, and AWS Lambda all to finish before seeing "Success". This is slow.

### The Solution (Event Loop)

We use an asynchronous event loop:

1. **Listing Service** (Producer) -> Emits `order_created`.
2. **Transaction Service** (Consumer) -> Picks up `order_created`, calculates fees, saves to DB.
3. **Transaction Service** (Producer) -> Emits `item_sold` confirmation.
4. **Listing Service** (Consumer) -> Listens for `item_sold` to update its local database state.
The Listing Service emits an event (order_created) to signify a purchase. RabbitMQ routes this message to the transactions queue, where the Transaction Service processes it.
An aws faas calculates the fees and saves the transaction new data to the db. T

### System Architecture
# We utilize the Publisher/Subscriber pattern to decouple our services.
1. User clicks "Buy".
2. Listing Service marks item isSold = true and emits order_created to RabbitMQ.
3. Listing Service returns "Purchase Successful" to the user instantly.
4. Transaction Service receives order_created, calls AWS Lambda, and saves the transaction.
5. Transaction Service emits item_sold confirmation back to Listing Service.
6. Listing Service receives confirmation and ensures data consistency.

## Infrastructure Setup

We define RabbitMQ as a service in our `docker-compose.yml`.

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    networks:
      - microstore-network

```
---
## Implementation Step 1: The Listing Service (Producer)

The Listing Service initiates the process. First, we register the RabbitMQ client in the module.

**File:** `src/listings.module.ts`

```typescript
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'TRANSACTION_SERVICE', // Injection token
        transport: Transport.RMQ,
        options: {
          // ⚠️ Connect to container name 'rabbitmq', NOT localhost
          urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672'],
          queue: 'transactions_queue',
          queueOptions: { durable: false },
        },
      },
    ]),
  ],
  // ... controllers & providers
})
export class ListingsModule {}

```

**File:** `src/listings.service.ts`
Here we inject the client and emit the event.

```typescript
@Injectable()
export class ListingsService {
  constructor(
    @Inject('TRANSACTION_SERVICE') private client: ClientProxy,
    // ... repositories
  ) {}

  async buyItem(listingId: number, buyerId: number) {
    // 1. Validation Logic...
    
    // 2. Emit the Event
    // We send the payload to the 'transactions_queue'
    this.client.emit('order_created', {
      listingId: listingId,
      sellerId: listing.sellerId,
      buyerId: buyerId,
      price: listing.price,
      createdAt: new Date(),
    });

    return { message: 'Purchase processing started' };
  }
}

```

---

## Implementation Step 2: The Transaction Service (Consumer)

The Transaction Service acts as a worker. It needs to listen to the queue.

**File:** `src/main.ts`
We convert the app to a Hybrid Microservice to enable listeners.

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Connect to RabbitMQ
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672'],
      queue: 'transactions_queue', // Must match the Producer's queue
      queueOptions: { durable: false },
    },
  });

  await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();

```

**File:** `src/app.controller.ts`
The controller uses `@EventPattern` to react to messages.

```typescript
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @EventPattern('order_created')
  async handleOrderCreated(@Payload() data: any) {
    // Pass data to service for processing
    return this.appService.createTransaction(data);
  }
}

```

**File:** `src/app.service.ts`
The service processes the logic (including the FaaS call) and then emits a reply event.

```typescript
@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Transaction) private repo: Repository<Transaction>,
    @Inject('LISTING_SERVICE') private client: ClientProxy // Inject client to reply
  ) {}

  async createTransaction(data: any) {
    console.log('📦 RabbitMQ Event Received:', data);

    // 1. Call External AWS Lambda for Fee Calculation (Synchronous HTTP)
    const awsResponse = await axios.post(
       "https://your-lambda-url.on.aws/", 
       { price: data.price }
    );
    const finalPrice = awsResponse.data.total;

    // 2. Save Transaction
    const transaction = this.repo.create({ ...data, price: finalPrice });
    await this.repo.save(transaction);

    // 3. 📢 REPLY: Tell Listing Service the item is officially sold
    this.client.emit('item_sold', { 
       listingId: data.listingId, 
       transactionId: transaction.id 
    });
  }
}

```

---

## 6. Implementation Step 3: Closing the Loop

Back in the **Listing Service**, we need to listen for the confirmation (`item_sold`) to finalize the state.

**File:** `src/listings.controller.ts`

```typescript
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly gateway: ListingsGateway 
  ) {}

  // ... standard HTTP endpoints

  // 👇 Listener for the Reply
  @EventPattern('item_sold') 
  async handleItemSold(@Payload() data: any) {
    console.log('🐰 Confirmation Received: item_sold', data);
    
    // 1. Update Database (Persistence)
    await this.listingsService.update(data.listingId, { isSold: true });

    // 2. Update Frontend (Real-time)
    this.gateway.notifyItemSold(data.listingId);
  }
}

```

---

## 7. Summary of Results

By implementing RabbitMQ, the MicroStore project achieved:

1. **Fault Tolerance:** If the `transaction-service` crashes, the "buy" requests remain in the queue and are processed automatically when the service restarts.
2. **Scalability:** We can spin up multiple instances of `transaction-service` to process the RabbitMQ queue faster without changing the frontend code.
3. **Responsiveness:** The user interface remains usable because it doesn't block while waiting for the AWS Lambda fee calculation.

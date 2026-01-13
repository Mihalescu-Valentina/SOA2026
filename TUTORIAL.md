# Tutorial: Asynchronous Microservices with RabbitMQ in NestJS

* **Project:** MicroStore (Distributed E-Commerce System)
* **Focus:** Message Brokers, Event-Driven Architecture, and Decoupling

## Introduction to RabbitMQ

In a monolithic application, components talk to each other directly (like function calls). In a distributed system, services must communicate efficiently without blocking the user. A common pitfall is **Tight Coupling**, where Service A waits for Service B to finish before responding to the user.

In this tutorial, I will show how I solved this problem via RabbitMQ using the "Buy Item" functionality as an example.

**RabbitMQ** is a **Message Broker**. We can say it's similar to a **Digital Post Office**:

1. **Producer (Sender):** Writes a letter (data), puts it in an envelope, and drops it in a mailbox. It doesn't care *who* delivers it or *when*. It just trusts it will get there.
2. **Queue (Mailbox):** A buffer where messages sit until they can be processed.
3. **Consumer (Receiver):** The mailman who picks up the letter, opens it, and does the actual work.

### Why use RabbitMQ instead of HTTP?

* **Decoupling:** If the Transaction Service is down or slow, the Listing Service doesn't crash. It just drops the message in the queue and moves on.
* **Performance:** The user gets an immediate response, while the heavy lifting (creating records, calculating taxes via FaaS) happens in the background.
* **Reliability:** Messages persist in the queue until they are successfully processed.

---

## Applied Architecture: The "Buy Item" Flow

In **MicroStore**, we use RabbitMQ to handle the critical "Purchase" workflow.

### The Challenge

When a user clicks "Buy", two things must happen:

1. **Listing Service:** Must mark the item as "Sold" so no one else buys it.
2. **Transaction Service:** Must create a transaction record, which involves calling an external **AWS Lambda (FaaS)** function to calculate fees.

If we did this synchronously (HTTP), the user would have to wait for the Database, RabbitMQ, and AWS Lambda all to finish before seeing "Success". This is slow.

### The Solution (Event Loop)

We use an asynchronous event loop and the **Publisher/Subscriber** pattern:

1. **User** clicks "Buy".
2. **Listing Service** (Producer) marks the item `isSold = true` locally.
3. **Listing Service** emits `order_created` to RabbitMQ.
4. **Listing Service** returns "Purchase Successful" to the user **instantly**.
5. **Transaction Service** (Consumer) picks up `order_created`, calls AWS Lambda for fees, and saves the transaction.
6. **Transaction Service** (Producer) emits `item_sold` confirmation back to the Listing Service.
7. **Listing Service** (Consumer) receives the confirmation and ensures data consistency.

---

## Infrastructure Setup

We define RabbitMQ as a service in our `docker-compose.yml`.

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    ports:
      - "5672:5672"   # AMQP Protocol
      - "15672:15672" # Management UI
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

Here we inject the client, emit the event, and return an immediate success message (Optimistic UI).

```typescript
@Injectable()
export class ListingsService {
  constructor(
    @Inject('TRANSACTION_SERVICE') private client: ClientProxy,
    @InjectRepository(Listing) private listingRepository: Repository<Listing>,
    private listingsGateway: ListingsGateway,
  ) {}

  async buyItem(listingId: number, buyerId: number) {
    const listing = await this.findOne(listingId);

    // 1. Validation Logic
    if (listing.isSold) throw new BadRequestException('Already sold');
    
    // 2. Optimistic Update (Instant)
    listing.isSold = true;
    await this.listingRepository.save(listing);
    this.listingsGateway.notifyItemSold(listingId); // Notify Frontend via Socket

    // 3. Emit the Event (Async)
    // We send the payload to the 'transactions_queue'
    this.client.emit('order_created', {
      listingId: listingId,
      sellerId: listing.sellerId,
      buyerId: buyerId,
      price: listing.price,
      createdAt: new Date(),
    });

    return { message: 'Purchase successful', listing };
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
  await app.listen(3002);
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
    let finalPrice = data.price;
    try {
        const awsResponse = await axios.post(
           "https://your-lambda-url.on.aws/", 
           { price: data.price }
        );
        finalPrice = awsResponse.data.total;
    } catch (e) {
        console.error("AWS Lambda failed, using default price");
    }

    // 2. Save Transaction
    const transaction = this.repo.create({ ...data, price: finalPrice });
    const saved = await this.repo.save(transaction);

    // 3. 📢 REPLY: Tell Listing Service the item is officially sold
    this.client.emit('item_sold', { 
       listingId: data.listingId, 
       transactionId: saved.id 
    });
  }
}

```

---

## Implementation Step 3: Closing the Loop

Back in the **Listing Service**, we listen for the confirmation (`item_sold`) to finalize the state.

**File:** `src/listings.controller.ts`

```typescript
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly gateway: ListingsGateway 
  ) {}

  // 👇 Listener for the Reply
  @EventPattern('item_sold') 
  async handleItemSold(@Payload() data: any) {
    console.log('🐰 Confirmation Received: item_sold', data);
    
    // 1. Update Database (Persistence check)
    await this.listingsService.update(data.listingId, { isSold: true });

    // 2. Update Frontend (Redundant safety for WebSockets)
    this.gateway.notifyItemSold(data.listingId);
  }
}

```

---

## Summary of Results

By implementing RabbitMQ, the MicroStore project achieved:

1. **Fault Tolerance:** If the `transaction-service` crashes, the "buy" requests remain in the queue and are processed automatically when the service restarts.
2. **Scalability:** We can spin up multiple instances of `transaction-service` to process the RabbitMQ queue faster without changing the frontend code.
3. **Responsiveness:** The user interface remains usable because it doesn't block while waiting for the AWS Lambda fee calculation.

## Verification & Logs

To confirm the architecture is working, we can inspect the logs of our containers.

### 1. RabbitMQ Connection

In the picture below we can see a screenshot of the logs from the RabbitMQ container
![rabbitmq-console-log](https://github.com/user-attachments/assets/e5ddc4f9-8752-4fa5-b369-9a91367bc33a)

### 2. Transaction Processing

When a user clicks "Buy", we can see the Transaction Service receiving the event and calculating the fee.

*Figure 2: Transaction Service logs showing the received event and AWS Lambda fee calculation.*



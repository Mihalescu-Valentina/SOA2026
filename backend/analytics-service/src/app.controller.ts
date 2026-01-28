import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class AppController {
  // 🧠 In-Memory Database to store the counts
  // Structure: { listingId: count } -> e.g., { 5: 10, 8: 3 }
  private viewCounts = new Map<number, number>();

  @EventPattern('listing_viewed')
  handleListingView(@Payload() message: any) {
    const id = message.listingId;

    // 1. Get the current count (or 0 if it's the first time)
    const currentCount = this.viewCounts.get(id) || 0;

    // 2. Increment the count
    const newCount = currentCount + 1;

    // 3. Save it back
    this.viewCounts.set(id, newCount);

    // 4. Print the helpful Analytics Report
    console.clear(); // Optional: clears clutter
    console.log('📊 LIVE ANALYTICS DASHBOARD');
    console.log('=================================');
    console.log(`👁️  New Event: User viewed Item #${id}`);
    console.log(`📈  TOTAL VIEWS for Item #${id}: ${newCount}`);
    console.log('=================================');

    // Optional: Print top items
    console.log('🏆 Popular Items:');
    this.viewCounts.forEach((count, key) => {
      console.log(`   - Item #${key}: ${count} views`);
    });
  }
}
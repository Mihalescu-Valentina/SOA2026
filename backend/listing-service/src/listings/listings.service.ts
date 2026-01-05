import { 
  Injectable, 
  Inject, 
  NotFoundException, 
  BadRequestException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { Listing } from './entities/listing.entity';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing)
    private listingRepository: Repository<Listing>,
    @Inject('TRANSACTION_SERVICE') private client: ClientProxy,
  ) {}

  async create(createListingDto: CreateListingDto) {
    return await this.listingRepository.save(createListingDto);
  }

  async findAll() {
    // Only return items that are NOT sold
    return await this.listingRepository.find({
      where: { isSold: false }
    });
  }

  async findOne(id: number) {
    return await this.listingRepository.findOne({ where: { id } });
  }

  async update(id: number, updateListingDto: UpdateListingDto) {
    await this.listingRepository.update(id, updateListingDto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.listingRepository.delete(id);
    return { deleted: true, id };
  }

  async buyItem(listingId: number, buyerId: number) {
    const listing = await this.findOne(listingId);

    // 1. Check if it exists
    if (!listing) {
      throw new NotFoundException(`Listing #${listingId} not found`);
    }

    // 2. NEW: Prevent self-buying 🛑
    if (listing.sellerId === buyerId) {
      throw new BadRequestException("You cannot buy your own item!");
    }

    // 3. Check if it is already sold
    if (listing.isSold) {
      throw new BadRequestException('Sorry, this listing is already sold');
    }

    // 4. Mark as Sold
    listing.isSold = true;
    await this.listingRepository.save(listing);

    // 5. Send receipt to RabbitMQ
    this.client.emit('order_created', {
      listingId: listing.id,
      sellerId: listing.sellerId,
      buyerId: buyerId,
      price: listing.price,
      createdAt: new Date(),
    });

    return { message: 'Purchase successful', listing };
  }
}
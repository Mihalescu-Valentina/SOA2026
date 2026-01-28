import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { AuthGuard } from '@nestjs/passport/dist/auth.guard';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) { }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() createListingDto: CreateListingDto, @Req() req) {

    console.log('User from Token:', req.user);
    createListingDto.sellerId = req.user.userId;

    return this.listingsService.create(createListingDto);
  }

  @Get()
  findAll() {
    return this.listingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listingsService.findOne(+id);
  }

  // UPDATED: Pass userId to service
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateListingDto: UpdateListingDto, @Req() req) {
    return this.listingsService.update(+id, updateListingDto, req.user.userId);
  }

  // UPDATED: Pass userId to service
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string, @Req() req) {
    return this.listingsService.remove(+id, req.user.userId);
  }

  @Post(':id/buy')
  @UseGuards(AuthGuard('jwt'))
  buy(@Param('id') id: string, @Req() req) {
    // req.user.userId comes from the JWT token (The Buyer)
    return this.listingsService.buyItem(+id, req.user.userId);
  }
}

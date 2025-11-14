import { Body, Controller, Get, Post, Optional } from '@nestjs/common';
import { NewTicketDto, TicketDto } from './dto';
import { TicketsService } from './tickets.service';

@Controller('api/v1/tickets')
export class TicketsController {
  constructor(@Optional() private ticketsService: TicketsService) {}

  @Get()
  async findAll(): Promise<Array<TicketDto>> {
    return this.ticketsService.findAll();
  }

  @Post()
  async create(@Body() createTicketDto: NewTicketDto): Promise<TicketDto> {
    return this.ticketsService.create(createTicketDto);
  }
}

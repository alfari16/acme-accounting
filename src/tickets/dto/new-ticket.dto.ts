import { IsNumber, IsEnum } from 'class-validator';
import { TicketType } from '../../../db/models/Ticket';

// Validation class for ValidationPipe
export class CreateTicketDto {
  @IsEnum(TicketType)
  type: TicketType;

  @IsNumber()
  companyId: number;
}

// Interface for backward compatibility with tests
export interface NewTicketDto {
  type: TicketType;
  companyId: number;
}

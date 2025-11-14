import {
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../../db/models/Ticket';

export interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

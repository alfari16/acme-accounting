import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { UniqueConstraintError, Op } from 'sequelize';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { Sequelize } from 'sequelize-typescript';

interface newTicketDto {
  type: TicketType;
  companyId: number;
}

interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

@Controller('api/v1/tickets')
export class TicketsController {
  constructor(private sequelize: Sequelize) {}
  @Get()
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;

    // check if company already has an open strikeOff ticket (prevent any new ticket creation)
    if (type !== TicketType.strikeOff) {
      const existingStrikeOffTicket = await Ticket.findOne({
        where: {
          companyId,
          type: TicketType.strikeOff,
          status: TicketStatus.open,
        },
      });

      if (existingStrikeOffTicket) {
        throw new ConflictException(
          'Cannot create new tickets when company has an open strikeOff ticket',
        );
      }
    }

    let category: TicketCategory;
    if (type === TicketType.managementReport) {
      category = TicketCategory.accounting;
    } else if (type === TicketType.strikeOff) {
      category = TicketCategory.management;
    } else {
      category = TicketCategory.corporate;
    }

    let userRole: UserRole;
    if (type === TicketType.managementReport) {
      userRole = UserRole.accountant;
    } else if (type === TicketType.strikeOff) {
      userRole = UserRole.director;
    } else {
      userRole = UserRole.corporateSecretary;
    }

    let assignees = await User.findAll({
      where: { companyId, role: userRole },
      order: [['createdAt', 'DESC']],
    });

    if (!assignees.length && type === TicketType.registrationAddressChange) {
      userRole = UserRole.director;
      assignees = await User.findAll({
        where: { companyId, role: userRole },
      });
    }

    if (!assignees.length) {
      throw new ConflictException(
        `Cannot find user with role ${userRole} to create a ticket`,
      );
    }

    if (userRole !== UserRole.accountant && assignees.length > 1)
      throw new ConflictException(
        `Multiple users with role ${userRole}. Cannot create a ticket`,
      );

    const assignee = assignees[0];

    const transaction = await this.sequelize.transaction();

    try {
      if (type === TicketType.strikeOff) {
        await Ticket.update(
          { status: TicketStatus.resolved },
          {
            where: {
              companyId,
              status: TicketStatus.open,
              type: {
                [Op.ne]: TicketType.strikeOff,
              },
            },
            transaction,
          },
        );
      }

      const ticket = await Ticket.create(
        {
          companyId,
          assigneeId: assignee.id,
          category,
          type,
          status: TicketStatus.open,
        },
        { transaction },
      );

      await transaction.commit();

      const ticketDto: TicketDto = {
        id: ticket.id,
        type: ticket.type,
        assigneeId: ticket.assigneeId,
        status: ticket.status,
        category: ticket.category,
        companyId: ticket.companyId,
      };

      return ticketDto;
    } catch (error) {
      await transaction.rollback();

      if (error instanceof UniqueConstraintError) {
        if (type === TicketType.strikeOff) {
          throw new ConflictException(
            'strikeOff ticket already exists for this company',
          );
        } else if (type === TicketType.registrationAddressChange) {
          throw new ConflictException(
            'registrationAddressChange ticket already exists for this company',
          );
        } else {
          throw new ConflictException('Ticket already exists for this company');
        }
      }
      throw error;
    }
  }
}

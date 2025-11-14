import { ConflictException, Injectable } from '@nestjs/common';
import { UniqueConstraintError, Op, Transaction } from 'sequelize';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { Sequelize } from 'sequelize-typescript';
import { NewTicketDto, TicketDto } from './dto';

@Injectable()
export class TicketsService {
  constructor(private sequelize: Sequelize) {}

  async findAll(): Promise<Array<TicketDto>> {
    return await Ticket.findAll({ include: [Company, User] });
  }

  async create(newTicketDto: NewTicketDto): Promise<TicketDto> {
    const { type, companyId } = newTicketDto;

    await this.validateStrikeOffTicket(type, companyId);
    const category = this.determineTicketCategory(type);
    const userRole = this.determineUserRole(type);
    const assignee = await this.findAndValidateAssignee(
      companyId,
      userRole,
      type,
    );

    return await this.createTicketWithTransaction(
      newTicketDto,
      category,
      assignee,
    );
  }

  private async validateStrikeOffTicket(
    type: TicketType,
    companyId: number,
  ): Promise<void> {
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
  }

  private determineTicketCategory(type: TicketType): TicketCategory {
    switch (type) {
      case TicketType.managementReport:
        return TicketCategory.accounting;
      case TicketType.strikeOff:
        return TicketCategory.management;
      default:
        return TicketCategory.corporate;
    }
  }

  private determineUserRole(type: TicketType): UserRole {
    switch (type) {
      case TicketType.managementReport:
        return UserRole.accountant;
      case TicketType.strikeOff:
        return UserRole.director;
      default:
        return UserRole.corporateSecretary;
    }
  }

  private async findAndValidateAssignee(
    companyId: number,
    userRole: UserRole,
    type: TicketType,
  ): Promise<User> {
    let assignees = await User.findAll({
      where: { companyId, role: userRole },
      order: [['createdAt', 'DESC']],
    });

    if (!assignees.length && type === TicketType.registrationAddressChange) {
      userRole = UserRole.director;
      assignees = await User.findAll({
        where: { companyId, role: userRole },
      });

      if (!assignees.length) {
        throw new ConflictException(
          `Cannot find user with role ${UserRole.corporateSecretary} or ${UserRole.director} to create a ticket`,
        );
      }
    }

    if (!assignees.length) {
      throw new ConflictException(
        `Cannot find user with role ${userRole} to create a ticket`,
      );
    }

    if (userRole !== UserRole.accountant && assignees.length > 1) {
      throw new ConflictException(
        `Multiple users with role ${userRole}. Cannot create a ticket`,
      );
    }

    return assignees[0];
  }

  private async createTicketWithTransaction(
    newTicketDto: NewTicketDto,
    category: TicketCategory,
    assignee: User,
  ): Promise<TicketDto> {
    const { type, companyId } = newTicketDto;
    const transaction = await this.sequelize.transaction();

    try {
      if (type === TicketType.strikeOff) {
        await this.resolveExistingOpenTickets(companyId, transaction);
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

      return this.mapToTicketDto(ticket);
    } catch (error) {
      await transaction.rollback();
      this.handleCreationError(error, type);
      throw error;
    }
  }

  private async resolveExistingOpenTickets(
    companyId: number,
    transaction: Transaction,
  ): Promise<void> {
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

  private mapToTicketDto(ticket: Ticket): TicketDto {
    return {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };
  }

  private handleCreationError(error: any, type: TicketType): void {
    if (error instanceof UniqueConstraintError) {
      switch (type) {
        case TicketType.strikeOff:
          throw new ConflictException(
            'strikeOff ticket already exists for this company',
          );
        case TicketType.registrationAddressChange:
          throw new ConflictException(
            'registrationAddressChange ticket already exists for this company',
          );
        default:
          throw new ConflictException('Ticket already exists for this company');
      }
    }
  }
}

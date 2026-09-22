import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import type { EwiInvestigationJobRecord } from '../jobs/ewi-investigation-job.types';

@WebSocketGateway({
  namespace: '/ewi',
  cors: { origin: true, credentials: true },
})
export class EwiInvestigationGateway {
  private readonly logger = new Logger(EwiInvestigationGateway.name);

  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() body: { jobId?: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const jobId = body?.jobId;
    if (!jobId) return;
    void client.join(this.room(jobId));
    this.logger.debug(`Client subscribed to EWI job ${jobId}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() body: { jobId?: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const jobId = body?.jobId;
    if (!jobId) return;
    void client.leave(this.room(jobId));
  }

  emitJobUpdate(record: EwiInvestigationJobRecord): void {
    this.server?.to(this.room(record.jobId)).emit('job:update', record);
  }

  private room(jobId: string): string {
    return `ewi:job:${jobId}`;
  }
}

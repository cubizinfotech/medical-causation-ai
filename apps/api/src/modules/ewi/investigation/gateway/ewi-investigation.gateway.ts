import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '@platform/auth/auth.service';
import type { EwiInvestigationJobRecord } from '../jobs/ewi-investigation-job.types';

@WebSocketGateway({
  namespace: '/ewi',
  cors: { origin: true, credentials: true },
})
export class EwiInvestigationGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EwiInvestigationGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly auth: AuthService) {}

  async handleConnection(client: Socket): Promise<void> {
    const allowed = await this.auth.allowSocket(client);
    if (!allowed) client.disconnect(true);
  }

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

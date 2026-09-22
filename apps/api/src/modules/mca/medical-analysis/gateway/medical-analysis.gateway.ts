import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Server, Socket } from 'socket.io';
import type { AppSettings } from '@config/config.types';
import type { MedicalAnalysisJobRecord } from '../jobs/medical-analysis-job.types';

export type MedicalAnalysisJobUpdate = Pick<
  MedicalAnalysisJobRecord,
  | 'jobId'
  | 'status'
  | 'step'
  | 'stepLabel'
  | 'progress'
  | 'message'
  | 'error'
  | 'result'
  | 'updatedAt'
  | 'completedAt'
>;

@WebSocketGateway({
  namespace: '/medical-analysis',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class MedicalAnalysisGateway implements OnGatewayInit {
  private readonly logger = new Logger(MedicalAnalysisGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly configService: ConfigService) {}

  afterInit(): void {
    const app = this.configService.get<AppSettings>('app');
    this.logger.log(
      `WebSocket gateway ready at /medical-analysis (frontend: ${app?.frontendUrl})`,
    );
  }

  emitJobUpdate(jobId: string, payload: MedicalAnalysisJobUpdate): void {
    this.server.to(this.room(jobId)).emit('job:update', payload);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { jobId?: string } | string,
  ): void {
    const jobId =
      typeof payload === 'string' ? payload : payload?.jobId?.trim();

    if (!jobId) {
      client.emit('job:error', { message: 'jobId is required to subscribe' });
      return;
    }

    void client.join(this.room(jobId));
    this.logger.debug(`Client ${client.id} subscribed to job ${jobId}`);
    client.emit('job:subscribed', { jobId });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { jobId?: string } | string,
  ): void {
    const jobId =
      typeof payload === 'string' ? payload : payload?.jobId?.trim();
    if (!jobId) return;
    void client.leave(this.room(jobId));
  }

  private room(jobId: string): string {
    return `job:${jobId}`;
  }
}

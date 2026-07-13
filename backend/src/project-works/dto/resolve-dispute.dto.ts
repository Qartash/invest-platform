import { IsBoolean } from 'class-validator';

export class ResolveDisputeDto {
  @IsBoolean()
  releaseToWorker: boolean;
}

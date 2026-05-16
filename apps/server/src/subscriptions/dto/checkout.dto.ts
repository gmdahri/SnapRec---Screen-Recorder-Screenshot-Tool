import { IsOptional, IsString } from 'class-validator';

export class CheckoutDto {
    @IsOptional()
    @IsString()
    successUrl?: string;

    @IsOptional()
    @IsString()
    cancelUrl?: string;
}

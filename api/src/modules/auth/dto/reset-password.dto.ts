import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
    @ApiProperty({
        description: 'Password reset token from email link',
        example: 'a1b2c3d4e5f6...',
    })
    @IsString()
    @MinLength(1)
    token: string;

    @ApiProperty({
        description: 'New password (minimum 6 characters)',
        example: 'newpassword123',
        minLength: 6,
    })
    @IsString()
    @MinLength(6)
    password: string;
}

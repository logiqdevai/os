import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterEmailDto {
    @ApiProperty({ description: 'User email address', example: 'user@example.com', format: 'email' })
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Password (minimum 8 characters)', example: 'correct-horse-battery', minLength: 8 })
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    password: string;

    @ApiProperty({ example: 'Anna' })
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    first_name: string;

    @ApiProperty({ example: 'Meyer' })
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    last_name: string;

    @ApiProperty({ description: 'Name of the agency (creates the organization). Omit when joining through an invitation.', required: false, example: 'Logiqdev' })
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    organization_name?: string;

    @ApiProperty({ description: 'Invitation token to accept while registering', required: false })
    @IsOptional()
    @IsString()
    invitation_token?: string;
}

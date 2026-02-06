import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
    // Override handleRequest to not throw an error if user is missing
    handleRequest(err: any, user: any) {
        if (err || !user) {
            return null;
        }
        return user;
    }
}

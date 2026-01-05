import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      
      // We must ignore expired tokens
      ignoreExpiration: false,
      
      secretOrKey: process.env.JWT_SECRET_KEY || 'secret', 
    });
  }

  async validate(payload: any) {
    return { 
      userId: payload.sub || payload.id, 
      email: payload.email || payload.username 
    };
  }
}
import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('stats')
  @Header('Cache-Control', 'public, max-age=300')
  async getStats() {
    return this.appService.getStats();
  }
}

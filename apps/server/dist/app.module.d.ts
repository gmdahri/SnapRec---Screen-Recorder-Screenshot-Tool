import { OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
export declare class AppModule implements OnModuleInit {
    private dataSource;
    private readonly logger;
    constructor(dataSource: DataSource);
    onModuleInit(): void;
}

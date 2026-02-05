"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AppModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const user_entity_1 = require("./users/entities/user.entity");
const recording_entity_1 = require("./recordings/entities/recording.entity");
const storage_module_1 = require("./storage/storage.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const recordings_module_1 = require("./recordings/recordings.module");
const typeorm_2 = require("typeorm");
let AppModule = AppModule_1 = class AppModule {
    dataSource;
    logger = new common_1.Logger(AppModule_1.name);
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    onModuleInit() {
        if (this.dataSource.isInitialized) {
            this.logger.log('Successfully connected to Supabase Database');
        }
        else {
            this.logger.error('Failed to connect to Supabase Database');
        }
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = AppModule_1 = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    type: 'postgres',
                    host: configService.get('DB_HOST'),
                    port: configService.get('DB_PORT', 5432),
                    username: configService.get('DB_USERNAME'),
                    password: configService.get('DB_PASSWORD'),
                    database: configService.get('DB_NAME'),
                    entities: [user_entity_1.User, recording_entity_1.Recording],
                    synchronize: false,
                    ssl: {
                        rejectUnauthorized: false,
                    },
                }),
            }),
            storage_module_1.StorageModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            recordings_module_1.RecordingsModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    }),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], AppModule);
//# sourceMappingURL=app.module.js.map
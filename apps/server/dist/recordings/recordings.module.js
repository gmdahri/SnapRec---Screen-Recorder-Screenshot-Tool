"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const recordings_controller_1 = require("./recordings.controller");
const recordings_service_1 = require("./recordings.service");
const recording_entity_1 = require("./entities/recording.entity");
const users_module_1 = require("../users/users.module");
const storage_module_1 = require("../storage/storage.module");
let RecordingsModule = class RecordingsModule {
};
exports.RecordingsModule = RecordingsModule;
exports.RecordingsModule = RecordingsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([recording_entity_1.Recording]),
            users_module_1.UsersModule,
            storage_module_1.StorageModule,
        ],
        controllers: [recordings_controller_1.RecordingsController],
        providers: [recordings_service_1.RecordingsService],
        exports: [recordings_service_1.RecordingsService],
    })
], RecordingsModule);
//# sourceMappingURL=recordings.module.js.map
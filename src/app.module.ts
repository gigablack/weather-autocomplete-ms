import { Module } from '@nestjs/common';
import { AutocompleteModule } from './autocomplete/autocomplete.module';
import { MongooseModule } from '@nestjs/mongoose';
import { envs } from './config';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';

@Module({
  imports: [
    AutocompleteModule,
    MongooseModule.forRoot(envs.mongo),
    CacheModule.register({
      isGlobal: true,
      stores: [createKeyv(envs.redis)],
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

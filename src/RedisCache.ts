import { ICacheController } from '@flex-cache/types';
import { Commands } from 'ioredis';

export interface RedisType {
    get: Commands['get'];
    set: Commands['set'];
    del: Commands['del'];
    setex: Commands['setex'];
}

export class RedisCache implements ICacheController {
    constructor(private redis: RedisType) {
    }

    delete<T>(name: string): Promise<void> {
        return this.redis.del(name).then(() => undefined);
    }

    get<T>(name: string): Promise<T | null> {
        return this.redis.get(name)
                   .then(data => {
                       if (typeof data !== 'string') {
                           return null;
                       }
                       return JSON.parse(data) as T;
                   });
    }

    set<T>(name: string, data: T, ttl: number): Promise<void> {
        if (data === undefined) {
            return Promise.reject(new Error('Data is not defined'));
        }
        
        const payload = JSON.stringify(data);

        if (ttl === Infinity) {
            return this.redis.set(name, payload).then(() => undefined);
        }

        const ttlSec = Math.ceil(ttl / 1000);
        return this.redis.setex(name, ttlSec, payload).then(() => undefined);
    }

}

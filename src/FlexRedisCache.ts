import { IFlexCache } from '@flex-cache/types';
import { Commands } from 'ioredis';

export interface RedisType {
    get: Commands['get'];
    set: Commands['set'];
    del: Commands['del'];
    setex: Commands['setex'];
}

enum SetType {
    set,
    setForce,
    update
}

export class FlexRedisCache implements IFlexCache {
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
        return this.redisSet(name, data, ttl, SetType.set);
    }

    update<T>(name: string, data: T, ttl: number): Promise<void> {
        return this.redisSet(name, data, ttl, SetType.update);
    }

    setForce<T>(name: string, data: T, ttl: number): Promise<void> {
        return this.redisSet(name, data, ttl, SetType.setForce);
    }

    private redisSet<T>(key: string, data: T, px: number, setType: SetType): Promise<void> {
        if (px <= 0) {
            return Promise.reject(new Error('TTL must be positive number'));
        }

        if (data === undefined) {
            return Promise.reject(new TypeError('Data is not defined'));
        }

        const value = JSON.stringify(data);
        
        const args: [string, string, string?, number?, string?] = [key, value];
        
        if (px !== Infinity) {
            args.push("PX", px);
        }

        if (setType === SetType.update) {
            args.push('XX');
        } else if (setType === SetType.set) {
            args.push('NX');
        }

        return this.redis.set(...args).then(result => {
            if (result?.toUpperCase() !== "OK") {
                throw new Error('Cannot set value for the key');
            }
        })
    }
}

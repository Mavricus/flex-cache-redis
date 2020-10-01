import { FlexRedisCache, RedisType } from '../src/FlexRedisCache';
import { Commands } from 'ioredis';
import { SinonStatic, SinonStub } from 'sinon';
import sinon from 'sinon';

class RedisMock implements RedisType {
    mock: {
        get: SinonStub;
        set: SinonStub;
        del: SinonStub;
        setex: SinonStub;
    }

    constructor(sinon: SinonStatic) {
        this.mock = {
            del: sinon.stub(),
            get: sinon.stub(),
            set: sinon.stub(),
            setex: sinon.stub()
        };
    }

    del: Commands["del"] = (...args: Array<any>) => this.mock.del(...args);

    get: Commands["get"] = (...args: Array<any>) => this.mock.get(...args);

    set: Commands["set"] = (...args: Array<any>) => this.mock.set(...args);

    setex: Commands["setex"] = (...args: Array<any>) => this.mock.setex(...args);
}

describe('RedisCache', () => {
    let cache: FlexRedisCache;
    let redis: RedisMock;
    const getResult: string = '{"result":"get"}';
    const setResult: string = '{"result":"set"}';
    const delResult: string = '{"result":"del"}';
    const setexResult: string = '{"result":"setex"}';

    beforeEach(() => {
        redis = new RedisMock(sinon);
        redis.mock.get.resolves(getResult);
        redis.mock.del.resolves(delResult);
        redis.mock.set.resolves(setResult);
        redis.mock.setex.resolves(setexResult);
        
        cache = new FlexRedisCache(redis);
    });

    describe('get', () => {
        it('should get data from redis and transform in to a JS Object', () => {
            return expect(cache.get('a')).resolves.toEqual({ result: 'get'})
                        .then(() => expect(redis.mock.get.calledOnce).toBe(true))
                        .then(() => expect(redis.mock.get.calledWith('a')).toBe(true));
        });
        it('should pass an error when redis.get returns exception', () => {
            const exception = new Error('Test error');
            redis.mock.get.rejects(exception);
            
            return expect(cache.get('a')).rejects.toBe(exception);
        });
        it('should return null if cache not found', () => {
            redis.mock.get.resolves(null);

            return expect(cache.get('a')).resolves.toBeNull();
        });
        it('should resolve with null if redis result is not string', () => {
            const tests = [null, undefined, 123, [], {}];
            tests.forEach((value, index) => redis.mock.get.onCall(index).resolves(value));

            return tests.reduce((chain: Promise<unknown>) => {
                return chain.then(() => expect(cache.get('a')).resolves.toBeNull());
            }, Promise.resolve());
        });
        it('should parse redis response correctly', () => {
            const cases = [
                { data: 'null', expectation: null },
                { data: '""', expectation: '' },
                { data: '"abc"', expectation: 'abc' },
                { data: '123', expectation: 123 },
                { data: '[]', expectation: [] },
                { data: '[1,2,3,"a","b","c"]', expectation: [1,2,3,'a','b','c'] },
                { data: '{}', expectation: {} },
                { data: '{"result":"data"}', expectation: { result: "data" } }
            ];

            cases.forEach(({ data }, index) => redis.mock.get.onCall(index).resolves(data));

            return cases.reduce((chain: Promise<unknown>, { expectation }) => {
                return chain.then(() => expect(cache.get('a')).resolves.toEqual(expectation));
            }, Promise.resolve());
        });
        it('should reject if redis result cannot be parsed', () => {
            const tests = ['', 'asd', 'undefined', '[asd]', '{asd:123}'];
            tests.forEach((value, index) => redis.mock.get.onCall(index).resolves(value));

            return tests.reduce((chain: Promise<unknown>) => {
                return chain.then(() => expect(cache.get('a')).rejects.toThrowError());
            }, Promise.resolve());
        });
    });

    describe('set', () => {
        it('should put data to rhe redis by key with specified ttl', () => {
            return expect(cache.set('a', 123, 5000)).resolves.toBeFalsy()
                        .then(() => expect(redis.mock.setex.calledOnce).toBe(true))
                        .then(() => expect(redis.mock.setex.calledWith('a', 5, "123")).toBe(true));
        });
        it('should convert ttl to seconds by rounding up', () => {
            return cache.set('a', 123, 5000)
                        .then(() => expect(redis.mock.setex.lastCall.calledWith('a', 5, "123")).toBe(true))
                        .then(() => cache.set('a', 123, 4999))
                        .then(() => expect(redis.mock.setex.lastCall.calledWith('a', 5, "123")).toBe(true))
                        .then(() => cache.set('a', 123, 5001))
                        .then(() => expect(redis.mock.setex.lastCall.calledWith('a', 6, "123")).toBe(true));
        });
        it('should use redis.set when ttl is Infinity', () => {
            return cache.set('a', 123, Infinity)
                        .then(() => expect(redis.mock.set.lastCall.calledWith('a', '123')).toBe(true));
        });
        it('should reject with error when data is undefined', () => {
            return expect(cache.set('a', undefined, Infinity)).rejects.toThrowError();
        });
        it('should reject with error when data is undefined', () => {
            return expect(cache.set('a', undefined, Infinity)).rejects.toThrowError();
        });
        it('should pass an error when redis.setex returns exception', () => {
            const exception = new Error('Test error');
            redis.mock.setex.rejects(exception);

            return expect(cache.set('a', 123, 5000)).rejects.toBe(exception);
        });
        it('should pass an error when redis.set returns exception', () => {
            const exception = new Error('Test error');
            redis.mock.set.rejects(exception);

            return expect(cache.set('a', 123, Infinity)).rejects.toBe(exception);
        });
        it('should reject with error when ttl is 0', () => {
            return expect(cache.set('a', 123, 0)).rejects.toThrowError();
        });
        it('should reject with error when ttl is negative', () => {
            return expect(cache.set('a', 123, -5000)).rejects.toThrowError();
        });
    });

    describe('del', () => {
        it('should delete data from redis by key', () => {
            return expect(cache.delete('a')).resolves.toBeFalsy();
        });
        it('should pass an error when redis cli returns exception', () => {
            const exception = new Error('Test error');
            redis.mock.del.rejects(exception);

            return expect(cache.delete('a')).rejects.toBe(exception);
        });
    });
});

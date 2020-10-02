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
    const setResult: string = 'OK';
    const delResult: number = 1;
    const setexResult: string = 'OK';

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

    describe('setForce', () => {
        it('should put data to the redis by key with specified ttl', () => {
            return expect(cache.setForce('a', 123, 5000)).resolves.toBeFalsy()
                        .then(() => expect(redis.mock.set.calledOnce).toBe(true))
                        .then(() => expect(redis.mock.set.calledWith('a', "123", "PX", 5000)).toBe(true));
        });
        it('should not pass PX flag when ttl is Infinity', () => {
            return cache.setForce('a', 123, Infinity)
                        .then(() => expect(redis.mock.set.calledWith('a', '123')).toBe(true));
        });
        it('should reject with error when data is undefined', () => {
            return expect(cache.setForce('a', undefined, Infinity)).rejects.toThrowError();
        });
        it('should pass an error when redis.set returns exception', () => {
            const exception = new Error('Test error');
            redis.mock.set.rejects(exception);

            return expect(cache.setForce('a', 123, 5000)).rejects.toBe(exception);
        });
        it('should pass an error when redis.set returns exception', () => {
            const exception = new Error('Test error');
            redis.mock.set.rejects(exception);

            return expect(cache.setForce('a', 123, Infinity)).rejects.toBe(exception);
        });
        it('should pass an error when redis.set returns not OK', () => {
            redis.mock.set.resolves('ERR');

            return expect(cache.setForce('a', 123, Infinity)).rejects.toThrowError();
        });
        it('should reject with error when ttl is 0', () => {
            return expect(cache.setForce('a', 123, 0)).rejects.toThrowError();
        });
        it('should reject with error when ttl is negative', () => {
            return expect(cache.setForce('a', 123, -5000)).rejects.toThrowError();
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

    describe('update', () => {
        it('should update data at the redis by key with specified ttl', () => {
            return expect(cache.update('a', 123, 5000)).resolves.toBeFalsy()
                        .then(() => expect(redis.mock.set.calledOnce).toBe(true))
                        .then(() => expect(redis.mock.set.calledWith('a', "123", "PX", 5000, 'XX')).toBe(true));
        });
        it('should not pass PX flag when ttl is Infinity', () => {
            return cache.update('a', 123, Infinity)
                        .then(() => expect(redis.mock.set.calledWith('a', '123', 'XX')).toBe(true));
        });
        it('should reject with error when data is undefined', () => {
            return expect(cache.update('a', undefined, Infinity)).rejects.toThrowError();
        });
        it('should pass an error when redis.set returns exception', () => {
            const exception = new Error('Test error');
            redis.mock.set.rejects(exception);

            return expect(cache.update('a', 123, 5000)).rejects.toBe(exception);
        });
        it('should pass an error when redis.set returns exception', () => {
            const exception = new Error('Test error');
            redis.mock.set.rejects(exception);

            return expect(cache.update('a', 123, Infinity)).rejects.toBe(exception);
        });
        it('should pass an error when redis.set returns not OK', () => {
            redis.mock.set.resolves('ERR');

            return expect(cache.update('a', 123, Infinity)).rejects.toThrowError();
        });
        it('should reject with error when ttl is 0', () => {
            return expect(cache.update('a', 123, 0)).rejects.toThrowError();
        });
        it('should reject with error when ttl is negative', () => {
            return expect(cache.update('a', 123, -5000)).rejects.toThrowError();
        });
    });

    describe('set', () => {
        it('should put data to the redis by key with specified ttl and NX flag', () => {
            return expect(cache.set('a', 123, 5000)).resolves.toBeFalsy()
                        .then(() => expect(redis.mock.set.calledOnce).toBe(true))
                        .then(() => expect(redis.mock.set.calledWith('a', "123", "PX", 5000, 'NX')).toBe(true));
        });
        it('should not pass PX flag when ttl is Infinity', () => {
            return cache.set('a', 123, Infinity)
                        .then(() => expect(redis.mock.set.calledWith('a', '123', 'NX')).toBe(true));
        });
        it('should reject with error when data is undefined', () => {
            return expect(cache.set('a', undefined, Infinity)).rejects.toThrowError();
        });
        it('should pass an error when redis.set returns exception', () => {
            const exception = new Error('Test error');
            redis.mock.set.rejects(exception);

            return expect(cache.set('a', 123, 5000)).rejects.toBe(exception);
        });
        it('should pass an error when redis.set returns exception', () => {
            const exception = new Error('Test error');
            redis.mock.set.rejects(exception);

            return expect(cache.set('a', 123, Infinity)).rejects.toBe(exception);
        });
        it('should pass an error when redis.set returns not OK', () => {
            redis.mock.set.resolves('ERR');

            return expect(cache.set('a', 123, Infinity)).rejects.toThrowError();
        });
        it('should reject with error when ttl is 0', () => {
            return expect(cache.set('a', 123, 0)).rejects.toThrowError();
        });
        it('should reject with error when ttl is negative', () => {
            return expect(cache.set('a', 123, -5000)).rejects.toThrowError();
        });
    });
});

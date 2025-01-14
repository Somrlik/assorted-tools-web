// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventMap = Record<string, EventReceiver<any>>;

type EventKey<T = EventMap> = (string) & keyof T;
type EventReceiver<T = never> = (params: T) => unknown;

/**
 * When you call this function, the event is turned off
 */
type Disposable = () => void;

interface Emitter<T extends EventMap> {
    on<K extends EventKey<T>>(eventName: K, fn: T[K]): Disposable;
    once<K extends EventKey<T>>(eventName: K, fn: T[K]): Disposable;
    off<K extends EventKey<T>>(eventName: K, fn: T[K]): void;
    emit<K extends EventKey<T>>(eventName: K, params: Parameters<T[K]>[]): void;
}

/**
 * Provides a sensible event emitter for Typescript
 */
export class EventEmitter<ActualEventMap extends EventMap> implements Emitter<ActualEventMap> {
    private readonly listeners: {
        [EventName in keyof EventMap]?: Array<EventMap[EventName]>;
    } = {};

    on<EventName extends EventKey<ActualEventMap>>(
        eventName: EventName,
        fn: ActualEventMap[EventName],
    ): Disposable {
        this.listeners[eventName] = (this.listeners[eventName] || []).concat(
            fn,
        );
        return () => this.off(eventName, fn);
    }

    once<EventName extends EventKey<ActualEventMap>>(
        eventName: EventName,
        fn: ActualEventMap[EventName],
    ): Disposable {
        const wrapper = (params: ActualEventMap[EventName]) => {
            fn(params);
            this.off(eventName, wrapper as ActualEventMap[EventName]);
        };
        this.listeners[eventName] = (this.listeners[eventName] || []).concat(
            wrapper,
        );
        return () => this.off(eventName, fn);
    }

    off<EventName extends EventKey<ActualEventMap>>(
        eventName: EventName,
        fn: ActualEventMap[EventName],
    ): void {
        this.listeners[eventName] = (this.listeners[eventName] || []).filter(
            (f) => f !== fn,
        );
    }

    emit<EventName extends EventKey<ActualEventMap>>(
        eventName: EventName,
        ...params: Parameters<ActualEventMap[EventName]>
    ): void {
        (this.listeners[eventName] || []).forEach(function (fn) {
            fn(params[0]);
        });
    }
}
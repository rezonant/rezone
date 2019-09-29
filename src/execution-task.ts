import { ExecutionContext } from "./execution-context";

export type ExecutionTaskEvent = 'cancel' | 'finish' | string;

export interface TaskContainer {
    callback : Function;
}


export class ExecutionTask {
    constructor(
        public unit : Function,
        readonly type : 'sync' | 'microtask' | 'macrotask' = 'sync',
        readonly contextStack : ExecutionContext[] = []
    ) {
    }

    private eventMap = new Map<string, Function[]>();
    
    runCount : number = 0;
    cancelled = false;

    private _wrapped = false;

    get wrapped() {
        return this._wrapped;
    }

    wrap<T>(augmentor : (func : Function) => (...args) => T) {
        this._wrapped = true;
        this.unit = augmentor(this.unit);
    }

    emit(eventName : string, ...args) {
        (this.eventMap.get(eventName) || []).forEach(handler => handler(...args));
    }
    
    addEventListener(eventName : ExecutionTaskEvent, callback : Function) {
        this.eventMap.set(eventName, (this.eventMap.get(eventName) || []).concat([ callback ]));
    }
    
    removeEventListener(eventName : string, callback : Function) {
        this.eventMap.set(eventName, (this.eventMap.get(eventName) || []).filter(x => x !== callback));
    }
}

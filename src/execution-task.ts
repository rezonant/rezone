
export type ExecutionTaskEvent = 'cancel' | 'finish';

export class ExecutionTask {
    constructor(
        private task : Task
    ) {    
    }

    private eventMap = new Map<string, Function[]>();
    
    get unit() {
        return this.task.callback;
    }

    set unit(value) {
        this.task.callback = value;
    }

    wrap<T>(augmentor : (func : Function) => (...args) => T) {
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

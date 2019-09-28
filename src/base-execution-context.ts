import { IExecutionContext } from "./i-execution-context";

export abstract class BaseExecutionContext implements IExecutionContext {
    abstract run<T>(func : (...args) => T): T;
    private eventMap = new Map<string, Function[]>();
    
    /**
     * Emit a particular message, receivable with addEventListener()
     * @param eventName 
     * @param args 
     */
    protected emit(eventName : string, ...args) {
        (this.eventMap.get(eventName) || []).forEach(handler => handler(...args));
    }

    addEventListener(eventName : string, callback : Function) {
        this.eventMap.set(eventName, (this.eventMap.get(eventName) || []).concat([ callback ]));
    }

    removeEventListener(eventName : string, callback : Function) {
        this.eventMap.set(eventName, (this.eventMap.get(eventName) || []).filter(x => x !== callback));
    }
}

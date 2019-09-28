import { ExecutionTask } from "./execution-task";

export interface IExecutionContext {
    run<T>(func : (...args) => T): T;
    schedule?(task : ExecutionTask);
    addEventListener(eventName : string, callback : Function);
    removeEventListener(eventName : string, callback : Function);
}

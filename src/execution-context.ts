import { ExecutionTask } from "./execution-task";
import { IExecutionContext } from "./i-execution-context";
import { BaseExecutionContext } from "./base-execution-context";
import { ComposedExecutionContext } from "./composed-execution-context";
import { capture, captureUnguarded } from "./privileged";

/**
 * A mechanism for tracking, altering, or fully replacing the synchronous functions 
 * involved in handling asynchronous flows.
 * 
 * Functions run within `ExecutionContext` (see `.run()`) will have their 
 * asynchronous operations _scheduled_ by calling the `.schedule()` method of 
 * the context instance.
 * 
 * Meant to be subclassed to be useful. Implement `.schedule()` to affect the execution
 * of code within the zone.
 */
export class ExecutionContext extends BaseExecutionContext implements IExecutionContext {
    constructor(...args) {
        super();
    }
    
    /**
     * Used to create a weak association between a Zone.js `Task` instance
     * and the `ExecutionTask` built by this library. 
     * 
     * This is an implementation detail of the polyfill implementation (`rezone`)
     */
    private taskMap = new WeakMap<Task, ExecutionTask>();

    /**
     * Retrieve the current stack of `ExecutionContext`s. When called on a subclass,
     * the returned items are filtered to those which are instances of or extend the 
     * subclass. So, to get the current stack of `FooContext`, use `FooContext.stack()`.
     * To get all execution contexts regardless of class, use `ExecutionContext.stack()`.
     * 
     * @param this 
     */
    public static stack<T extends typeof ExecutionContext>(this : T): InstanceType<T>[] {
        let zone = Zone.current;
        let stack : InstanceType<T>[] = [];

        while (zone) {
            let definingZone = zone.getZoneWith(`ec0:context`);
            let context = zone.get(`ec0:context`);

            if (definingZone === zone && context && context instanceof this)
                stack.push(<any>context);
            
            zone = zone.parent;
        }

        return stack;
    }

    /**
     * Fetch the top-most `ExecutionContext` which is an instance of the subclass `current()` 
     * is called on. Given a context `FooExecutionContext`, calling `FooExecutionContext.current()`
     * will return you the top-most context which is an instance of, or extends, `FooExecutionContext`.
     * To enumerate all active contexts, call this as `ExecutionContext.current()`
     * 
     * @param this 
     */
    public static current<T extends typeof ExecutionContext>(this : T): InstanceType<T> {
        return this.stack()[0];
    }

    /**
     * Find the topmost matching `ExecutionContext` (based on the subclass `fetch()` is called on),
     * and if one is found, execute `callback(matchingContext)`. If no matching context is found,
     * the given callback is not executed. The return value of the callback is passed through as
     * the return value of `fetch()`. Thus, you can fetch a zone-local value as such:
     * 
     * ```typescript
     * class MyExecutionContext extends ExecutionContext {
     *     color : string = 'blue';
     * }
     * 
     * // ...
     * 
     * let color : string = MyExecutionContext.fetch(context => context.color);
     * ```
     * 
     * @param this 
     * @param callback 
     */
    public static fetch<T extends typeof ExecutionContext, R>(this : T, callback : (context : InstanceType<T>) => R, defaultValue? : R): R {
        let context = this.current();
        if (context)
            return callback(context);
        
        return defaultValue;
    }

    /**
     * Create a new `ExecutionContext` which combines the behaviors of the given `contexts`.
     * The order of the contexts goes from outermost to innermost, so `compose(contextA, contextB, contextC)`
     * is equivalent to:
     * ```typescript
     *  contextA.run(() => contextB.run(() => contextC.run(() => codeRunInComposedContext())));
     * ```
     * 
     * @param contexts 
     */
    public static compose(...contexts : ExecutionContext[]): IExecutionContext {
        return new ComposedExecutionContext(contexts);
    }

    /**
     * Create a new function which calls the given function within the current stack of 
     * ExecutionContexts. This is a privileged API, only available to the host environment.
     * 
     * @privileged
     * @param func 
     */
    public static [capture]<T extends Function>(type : 'sync' | 'macrotask' | 'microtask', func : T): T {
        let currentContext = ExecutionContext.current();
        let contextZone = Zone.current.parent;

        return <any>((...args) => contextZone.run(() => currentContext.executeTaskInZone(type, func)));
    }

    private static getTopContextZone() {
        return Zone.current.getZoneWith('ec0:context');
    }

    /**
     * Create a new function which calls the given function within the current stack of 
     * ExecutionContexts. This is a privileged API, only available to the host environment.
     * 
     * @privileged
     * @param func 
     */
    public static [captureUnguarded]<T extends Function>(type : 'sync' | 'macrotask' | 'microtask', func : T): T {
        let contextZone = this.getTopContextZone();
        let context = ExecutionContext.current();
        let error : any = undefined;

        return <any>((...args) => {
            try {
                return context.executeTaskInZone(type, () => {
                    try {
                        return func(...args)
                    } catch (e) {
                        error = e;
                    }
                });
            } finally {
                if (error) {
                    throw error;
                }
            }
        });
    }

    /**
     * Create a new function which calls the given function within this ExecutionContext when 
     * invoked. This call does not capture the current ExecutionContext stack, so when the 
     * resulting function is run, it is executed within the current stack of zones as they are 
     * outside of the call to the wrapped function.
     * 
     * @param func Function
     */
    public wrap<T extends Function>(func : T): T {
        return <any>((...args) => this.run(() => func(...args)));
    }

    /**
     * Construct a `Zone` that adds this `ExecutionContext` to the current
     * context stack without applying the transformational aspects of the context
     * defined by `schedule()`.
     * 
     * @param parentZone 
     */
    private forkContextZone(parentZone : Zone) {
        return parentZone.fork({
            name: 'ExecutionContext',
            properties: {
                'ec0:context': this
            }
        });
    }

    /**
     * Construct a `Zone` that represents this `ExecutionContext` by forking 
     * the given `contextZone`.
     * 
     * @param contextZone 
     */
    private forkExecutionZone(contextZone : Zone) {
        return contextZone.fork({
            name: 'ExecutionZone',
            onCancelTask: (pz, cz, tz, task) => {
                let etask = this.taskMap.get(task);

                etask.cancelled = true;
                etask.emit('cancel');

                return pz.cancelTask(tz, task);
            },
            onScheduleTask: (pz, cz, tz, task) => {
                let typeMap = {
                    microTask: 'microtask',
                    macroTask: 'macrotask',
                    eventTask: 'event'
                };

                let etask = new ExecutionTask(task.callback, typeMap[task.type as string], ExecutionContext.stack());
                task.callback = (...args) => etask.unit(...args);
                this.taskMap.set(task, etask);

                let ogUnit = etask.unit;
                etask.unit = (...args) => {
                    try {
                        return ogUnit(...args);
                    } finally {
                        etask.emit('finish');
                        // ExecutionContexts run scheduleTask once per iteration for
                        // setInterval.
    
                        if (task.source === 'setInterval') {
                            etask.runCount += 1;
                            if (!etask.cancelled)
                                this.schedule(etask);
                        }
                    }
                };
                    

                this.schedule(etask);
                return pz.scheduleTask(tz, task);
            }
        });
    }

    /**
     * Run the given function within this ExecutionContext, on top of the other 
     * contexts found on the current ExecutionContext stack.
     * 
     * @param func 
     */
    public run<T>(func : (...args) => T): T {
        return this.runInZone(Zone.current, func);
    }

    /**
     * Run the given function within this execution context within the given `parentZone`.
     * Normally `parentZone` is `Zone.current`, but use cases like `[capture*]()` use this
     * mechanism to record and restore the context stack when executing the function.
     * 
     * This method is an implementation detail of the polyfill version of ExecutionContext
     * (`rezone`). It would not exist in a native implementation that is part of the host 
     * environment.
     * 
     * @param parentZone The `Zone.js` zone that we should fork from while creating an
     *                   on-the-fly `Zone` for this `ExecutionContext`.
     * @param func The function that should be executed within this `ExecutionContext`.
     */
    private runInZone<T>(parentZone : Zone, func : (...args) => T): T {
        let contextZone = this.forkContextZone(parentZone);
        return contextZone.run(() => this.executeTaskInZone('sync', func));
    }

    private executeTaskInZone(type : 'sync' | 'macrotask' | 'microtask', func, args : any[] = []) {
        let executionZone = this.forkExecutionZone(Zone.current);
        let syncTask = new ExecutionTask(func, type, ExecutionContext.stack());
        this.schedule(syncTask);

        return executionZone.run(() => {
            let unit = syncTask.unit.bind(typeof window !== 'undefined' ? window : global);

            try {
                return unit(...args);
            } finally {
                syncTask.emit('finish');
            }
        });
    }

    /**
     * Executed when a task is scheduled for execution.
     * The task may be synchronous, asynchronous, or an event.
     * This method is called at the moment the work becomes scheduled
     * for the future. The `task.unit` property identifies the function 
     * which will be executed once the asynchronous work is completed.
     * 
     * Implementations of this method may choose to replace, wrap, or 
     * otherwise modify the `task.unit` function. Use `task.wrap()` 
     * as a convenient way to wrap the `unit` function. Most execution
     * contexts use this method to accomplish their use cases.
     * 
     * You may also choose to utilize lifecycle events on the `task`. 
     * Use `task.addEventListener('cancel')` to know when the asynchronous
     * task is cancelled, and thus `task.unit` will never be run (again).
     * 
     * Use `task.addEventListener('finish')` to know when the asynchronous
     * work is completed and the callback (`task.unit`) has been executed.
     * This event is emitted both when the `unit` function completes successfully
     * as well as when `unit` throws an error.
     * 
     * @param task The task being scheduled
     */
    schedule(task : ExecutionTask) {
        // no op means the task is unaltered
    }

    /**
     * Executed when code running within the execution context 
     * has exhausted the microtask queue. This is useful if you want 
     * to run something after all enqueued work (microtasks) has been
     * completed. This may (and likely will) be called multiple times 
     * as an asynchronous function is executed within the context.
     */
    // turn() {
    //     // no op
    // }
}

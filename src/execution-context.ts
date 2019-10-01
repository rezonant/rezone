import { ExecutionTask } from "./execution-task";
import { IExecutionContext } from "./i-execution-context";
import { BaseExecutionContext } from "./base-execution-context";
import { ComposedExecutionContext } from "./composed-execution-context";

export class ExecutionContext extends BaseExecutionContext implements IExecutionContext {
    constructor(...args) {
        super();
    }
    
    private taskMap = new WeakMap<Task, ExecutionTask>();

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

    public static current<T extends typeof ExecutionContext>(this : T): InstanceType<T> {
        return this.stack()[0];
    }

    public static fetch<T extends typeof ExecutionContext, R>(this : T, callback : (context : InstanceType<T>) => R): R {
        let context = this.current();
        if (context)
            return callback(context);
        
        return undefined;
    }

    public static compose(...contexts : ExecutionContext[]): IExecutionContext {
        return new ComposedExecutionContext(contexts);
    }

    /**
     * Create a new function which calls the given function within this ExecutionContext when invoked.
     * @param func Function
     */
    public wrap<T extends Function>(func : T): T {
        return <any>((...args) => this.run(() => func(...args)));
    }

    public run<T>(func : (...args) => T): T {
        let contextZone = Zone.current.fork({
            name: 'ExecutionContext',
            properties: {
                'ec0:context': this
            }
        });

        return contextZone.run(() => {
            let syncTask = new ExecutionTask(func, 'sync', ExecutionContext.stack());
            this.schedule(syncTask);

            let executionZone = Zone.current.fork({
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

            return executionZone.run(() => {
                let unit = syncTask.unit.bind(typeof window !== 'undefined' ? window : global);

                try {
                    return unit();
                } finally {
                    syncTask.emit('finish');
                }
            });
        });
    }

    schedule(task : ExecutionTask) {
        // no op means the task is unaltered
    }
}

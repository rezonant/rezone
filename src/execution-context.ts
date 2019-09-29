import { ExecutionTask } from "./execution-task";
import { IExecutionContext } from "./i-execution-context";
import { BaseExecutionContext } from "./base-execution-context";
import { ComposedExecutionContext } from "./composed-execution-context";

export class ExecutionContext extends BaseExecutionContext implements IExecutionContext {
    private taskMap = new WeakMap<Task, ExecutionTask>();

    public static stack<T extends typeof ExecutionContext>(this : T): InstanceType<T>[] {
        let zone = Zone.current;
        let stack : InstanceType<T>[] = [];

        while (zone) {
            let context = zone.get(`ec0:context`);
            if (context && context instanceof this)
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

    public run<T>(func : (...args) => T): T {
        let zone = Zone.current.fork({
            name: 'ExecutionContext',
            properties: {
                'ec0:context': this
            },
            onCancelTask: (pz, cz, tz, task) => {
                this.taskMap.get(task).emit('cancel');

                return pz.cancelTask(tz, task);
            },
            onScheduleTask: (pz, cz, tz, task) => {
                let etask = new ExecutionTask(task);
                this.taskMap.set(task, etask);

                let ogUnit = etask.unit;

                etask.unit = (...args) => {
                    try {
                        ogUnit(...args);
                    } finally {
                        etask.emit('finish');
                    }
                };

                this.schedule(etask);

                return pz.scheduleTask(tz, task);
            }
        });

        return zone.run(() => func());
    }

    schedule(task : ExecutionTask) {
    }
}

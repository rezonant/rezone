import { ExecutionTask } from "./execution-task";
import { IExecutionContext } from "./i-execution-context";
import { BaseExecutionContext } from "./base-execution-context";
import { ComposedExecutionContext } from "./composed-execution-context";

export class ExecutionContext extends BaseExecutionContext implements IExecutionContext {
    public static find(finder : (x : ExecutionContext) => boolean) : ExecutionContext {
        return this.stack.find(finder);
    }

    private taskMap = new WeakMap<Task, ExecutionTask>();

    public static get stack() : ExecutionContext[] {
        let zone = Zone.current;
        let stack = [];

        while (zone) {
            let context = zone.get(`ec0:context`);
            if (context)
                stack.push(context);
            
            zone = zone.parent;
        }

        return stack;
    }

    private static _root : ExecutionContext = null;
    public static get root() : ExecutionContext {
        if (!this._root) {
            this._root = new ExecutionContext();
        }

        return this._root;
    }

    public static get current() : ExecutionContext {
        return this.stack[0] || ExecutionContext.root;
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

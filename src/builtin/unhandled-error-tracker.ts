import { ExecutionContext } from "../execution-context";
import { ExecutionTask } from "../execution-task";

export class UnhandledErrorTracker extends ExecutionContext {
    constructor() {
        super();
    }

    schedule(task : ExecutionTask) {
        task.wrap(unit => (...args) => {
            try {
                unit(...args);
            } catch (e) {
                this.emit('error', e);
            }
        });
    }
}
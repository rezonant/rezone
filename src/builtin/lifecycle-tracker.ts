import { ExecutionContext } from "../execution-context";
import { ExecutionTask } from "../execution-task";

export class LifeCycleTracker extends ExecutionContext {
    constructor(
        readonly enabled = true
    ) {
        super();
    }

    private _counter = 0;

    schedule(task : ExecutionTask) {
        if (!this.enabled || LifeCycleTracker.current() !== this)
            return;


        this._counter += 1;
        let decrement = () => {

            if (--this._counter === 0)
                this.emit('stable');
        };

        task.addEventListener('cancel', () => decrement());
        task.addEventListener('finish', () => decrement());
    }
}
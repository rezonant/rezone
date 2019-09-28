import "zone.js";

import { ExecutionContext } from "./execution-context";
import { ExecutionTask } from "./execution-task";

export class UnhandledErrorInterceptor extends ExecutionContext {
    schedule(task : ExecutionTask) {
        task.wrap(callback => (...args) => {
            try {
                callback(...args);
            } catch (e) {
                console.error(`UnhandledErrorInterceptor: ${e}`);
                this.emit('error', e);
            }
        });
    }
}

export class LogExecutionContext extends ExecutionContext {
    schedule(task : ExecutionTask) {
        task.wrap(callback => (...args) => {
                console.log(`LogExecutionContext: Entered for callback '${callback.name}'`);
                callback(...args);
                console.log(`LogExecutionContext: Exited after callback '${callback.name}'`);
        });
    }
}

export class TrackExecutionContext extends ExecutionContext {
    private _counter = 0;

    get counter() {
        return this._counter;
    }

    schedule(task : ExecutionTask) {
        this._counter += 1;
        let decrement = () => {
            if (--this._counter === 0)
                this.emit('stable');
        };

        task.addEventListener('cancel', () => decrement());
        task.addEventListener('finish', () => decrement());
    }
}

function main() {
    let logContext = new LogExecutionContext();
    let errorInterceptor = new UnhandledErrorInterceptor();
    let executionTracker = new TrackExecutionContext();
    executionTracker.addEventListener('stable', () => {
        console.log(`all execution completed`);
    });

    let context = ExecutionContext.compose(logContext, errorInterceptor, executionTracker);

    context.run(() => {
        console.log('running in context');
        setTimeout(() => {
            console.log('shouldve caught a frame');
            setTimeout(() => {

            }, 2000);

            setTimeout(() => {

                let count = TrackExecutionContext.fetch(z => z.counter);
                console.log(`depth count: ${count}`);

                throw new Error('error here');
            }, 1000)
        }, 2000);
    });
}

main();
import { ExecutionContext } from "../execution-context";
import { ExecutionTask } from "../execution-task";

export class StateTracker extends ExecutionContext {
    constructor(
        readonly state : Record<string,any>
    ) {
        super();
    }

    static get<T>(key : string, defaultValue? : T): T {
        for (let tracker of StateTracker.stack()) {
            if (tracker.state[key] !== undefined)
                return tracker.state[key];
        }

        return defaultValue;
    }
}
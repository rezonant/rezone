import { ExecutionContext } from "../execution-context";
import { ExecutionTask } from "../execution-task";

export class StateTracker extends ExecutionContext {
    constructor(
        readonly state : Map<string,any>
    ) {
        super();
    }

    static get<T>(key : string, defaultValue? : T): T {
        for (let tracker of StateTracker.stack()) {
            if (tracker.state.has(key)) 
                return tracker.state.get(key);
        }

        return defaultValue;
    }
}
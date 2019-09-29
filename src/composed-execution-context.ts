import { BaseExecutionContext } from "./base-execution-context";
import { IExecutionContext } from "./i-execution-context";

export class ComposedExecutionContext extends BaseExecutionContext {
    constructor(private contexts : IExecutionContext[]) {
        super();
    }

    public run<T>(func : () => T): T {
        return this.contexts.reverse().reduce((composedFunc, context) => 
            () => context.run(composedFunc), func)();
    }
}

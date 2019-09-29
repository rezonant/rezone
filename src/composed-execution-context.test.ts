import { suite, it } from "razmin";
import { expect } from 'chai';
import { ComposedExecutionContext } from "./composed-execution-context";
import { IExecutionContext } from "./i-execution-context";
import { ExecutionTask } from "./execution-task";
import { ExecutionContext } from "./execution-context";

suite(describe => {
    describe('ComposedExecutionContext', () => {
        it('nests multiple contexts into each other', () => {
            let observed = '';
            class MockExecutionContext extends ExecutionContext {
                constructor(private value : string, private innerValue : string) {
                    super();
                }
    
                run(func : (...args) => any) {
                    observed += this.value;
                    return super.run(func);
                }

                schedule(task: ExecutionTask) {
                    observed += '-';
                    task.wrap(unit => (...args) => {
                        observed += this.innerValue + '-';
                        unit(...args);
                    });
                }
            }
    
            new ComposedExecutionContext([ 
                new MockExecutionContext('do', 're'),
                new MockExecutionContext('mi', 'fa'),
                new MockExecutionContext('so', 'la')
            ]).run(() => {
    
            });
    
            expect(observed).to.equal('do-re-mi-fa-so-la-');
        });
    });
})
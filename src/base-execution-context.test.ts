import { suite } from "razmin";
import { expect } from 'chai';
import { ExecutionContext } from "./execution-context";
import { ExecutionTask } from "./execution-task";

suite(describe => {
    describe('BaseExecutionContext', it => {
        class OpenExecutionContext extends ExecutionContext {
            emitOpen(eventName : string, ...args) {
                this.emit(eventName, ...args);
            }
        }

        describe('#emit()', it => {
            it('will not throw for events that have no listeners', () => {
                let context = new OpenExecutionContext();
                context.emitOpen('nonexistent-event');
            });
        });

        describe('#removeEventListener()', it => {
            it('will not throw for handlers that were not previously registered', () => {
                let context = new OpenExecutionContext();
                context.removeEventListener('nonexistent-event', () => {});
            })
            it('properly removes listeners', () => {
                let context = new OpenExecutionContext(() => {});
    
                let observedValue = 0;
                let handler = value => {
                    observedValue += value;
                };

                context.addEventListener('foobar', handler);
    
                context.emitOpen('foobar', 123);
                context.removeEventListener('foobar', handler);
                context.emitOpen('foobar', 123);
    
                expect(observedValue).to.equal(123);
            });
            
            it('only affects the specified listener', () => {

                let context = new OpenExecutionContext(() => {});
    
                let observedValue = 0;
                let handler = value => observedValue += value;
                let handler2 = value => observedValue += value * 10;

                context.addEventListener('foobar', handler);
                context.addEventListener('foobar', handler2);
    
                context.emitOpen('foobar', 10); // 0 + (10) + (10*10) = 110

                context.removeEventListener('foobar', handler);
                context.emitOpen('foobar', 20); // 110 + (20*10) = 110 + 200 = 310
    
                expect(observedValue).to.equal(310);
            });
        });

        describe('#addEventListener()', it => {
            it('registers a listener for an arbitrary event', () => {
                
                let context = new OpenExecutionContext(() => {});
                let observedValue = undefined;

                context.addEventListener('foobar', value => {
                    observedValue = value;
                })

                context.emitOpen('foobar', 123);

                expect(observedValue).to.equal(123);
            });
            it('allows multiple listeners for a single event', () => {
                
                let context = new OpenExecutionContext(() => {});
                let observedValue = 0;

                context.addEventListener('foobar', value => observedValue += value);
                context.addEventListener('foobar', value => observedValue += value*10);

                context.emitOpen('foobar', 10);

                expect(observedValue).to.equal(110);
            });
        });

    });
});
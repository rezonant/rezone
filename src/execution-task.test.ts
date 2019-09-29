import { suite } from "razmin";
import { ExecutionTask } from "./execution-task";
import { expect } from 'chai';

suite(describe => {
    describe('ExecutionTask', it => {
        describe('#removeEventListener()', it => {
            it('properly removes listeners', () => {

                let executionTask = new ExecutionTask({ 
                    callback: () => {}
                });
    
                let observedValue = 0;
                let handler = value => {
                    observedValue += value;
                };

                executionTask.addEventListener('foobar', handler);
    
                executionTask.emit('foobar', 123);
                executionTask.removeEventListener('foobar', handler);
                executionTask.emit('foobar', 123);
    
                expect(observedValue).to.equal(123);
            });
            
            it('only affects the specified listener', () => {

                let executionTask = new ExecutionTask({ 
                    callback: () => {}
                });
    
                let observedValue = 0;
                let handler = value => observedValue += value;
                let handler2 = value => observedValue += value * 10;

                executionTask.addEventListener('foobar', handler);
                executionTask.addEventListener('foobar', handler2);
    
                executionTask.emit('foobar', 10); // 0 + (10) + (10*10) = 110

                executionTask.removeEventListener('foobar', handler);
                executionTask.emit('foobar', 20); // 110 + (20*10) = 110 + 200 = 310
    
                expect(observedValue).to.equal(310);
            });
        });

        describe('#addEventListener()', it => {
            it('registers a listener for an arbitrary event', () => {
                
                let executionTask = new ExecutionTask({ 
                    callback: () => {}
                });

                let observedValue = undefined;

                executionTask.addEventListener('foobar', value => {
                    observedValue = value;
                })

                executionTask.emit('foobar', 123);

                expect(observedValue).to.equal(123);
            });
            it('allows multiple listeners for a single event', () => {
                
                let executionTask = new ExecutionTask({ 
                    callback: () => {}
                });

                let observedValue = 0;

                executionTask.addEventListener('foobar', value => observedValue += value);
                executionTask.addEventListener('foobar', value => observedValue += value*10);

                executionTask.emit('foobar', 10);

                expect(observedValue).to.equal(110);
            });
        });

        describe('#unit', it => {
            it('initializes to the value of the TaskContainer callback', () => {
                let callback = () => {};
                let executionTask = new ExecutionTask({ callback });
                expect(executionTask.unit).to.equal(callback);
            });
        });

        describe('#wrap()', it => {
            it('properly wraps the unit', () => {
                let observedValue;
                let counter = 0;
    
                let executionTask = new ExecutionTask({ 
                    callback: () => {
                        observedValue = counter;
                    } 
                });
    
                executionTask.wrap(unit => (...args) => {
                    counter += 1;
                    unit(...args);
                    counter -= 1;
                });
    
                executionTask.unit();
                expect(observedValue).to.equal(1);
            });
        });
    });
});
import { suite } from "razmin";
import { expect } from 'chai';
import { ExecutionContext } from "./execution-context";
import { ExecutionTask } from "./execution-task";

suite(describe => {
    describe('ExecutionContext', it => {
        it('propagates errors to parent contexts', () => {
            let observedOuter = false, observedInner = false;

            class ErrorObservingContext extends ExecutionContext {
                constructor(
                    private errorCallback : Function,
                    private eatErrors : boolean
                ) {
                    super();
                }

                schedule(task : ExecutionTask) {
                    task.wrap(unit => (...args) => {
                        try {
                            unit();
                        } catch (e) {
                            this.errorCallback(e);
                            if (!this.eatErrors)
                                throw e;
                        }
                    });
                }
            }

            let innerContext = new ErrorObservingContext(() => observedInner = true, false);
            let outerContext = new ErrorObservingContext(() => observedOuter = true, true);

            outerContext.run(() => {
                innerContext.run(() => {
                    setTimeout(() => {
                        throw new Error();
                    })
                })
            });

            setTimeout(() => {
                expect(observedInner, 'should observe error in inner context').to.be.true;
                expect(observedOuter, 'should observe error in outer context').to.be.true;
            }, 10);
        })

        describe('.stack()', it => {
            it('returns an empty array when called outside of any ExecutionContext', () => {
                expect(ExecutionContext.stack()).to.eql([]);
            });
            it('returns an array with the correct ExecutionContexts, in the correct order', () => {
                let executionsObserved = 0;
                let context = new ExecutionContext();
                let context2 = new ExecutionContext();
                let context3 = new ExecutionContext();

                context.run(() => {
                    expect(ExecutionContext.stack()).to.eql([ context ]);
                    executionsObserved += 1;
                });

                context.run(() => {
                    context2.run(() => {
                        expect(ExecutionContext.stack()).to.deep.equal([ context2, context ]);
                        executionsObserved += 1;
                    });
                });

                context.run(() => {
                    context2.run(() => {
                        context3.run(() => {
                            expect(ExecutionContext.stack()).to.deep.equal([ context3, context2, context ]);
                            executionsObserved += 1;
                        });
                    });
                });

                context3.run(() => {
                    context2.run(() => {
                        context.run(() => {
                            expect(ExecutionContext.stack()).to.deep.equal([ context, context2, context3 ]);
                            executionsObserved += 1;
                        });
                    });
                });
                
                expect(executionsObserved).to.equal(4);
            });
            it('returns an array with the correct ExecutionContexts, in the correct order, asynchronously', () => {
                let executionsObserved = 0;
                let context = new ExecutionContext();
                let context2 = new ExecutionContext();
                let context3 = new ExecutionContext();

                context.run(() => {
                    setTimeout(() => {
                        expect(ExecutionContext.stack()).to.eql([ context ]);
                        executionsObserved += 1;
                    });
                });

                context.run(() => {
                    setTimeout(() => {
                        context2.run(() => {
                            setTimeout(() => {
                                expect(ExecutionContext.stack()).to.deep.equal([ context2, context ]);
                                executionsObserved += 1;
                            });
                        });
                    });
                });

                context.run(() => {
                    setTimeout(() => {
                        context2.run(() => {
                            setTimeout(() => {
                                context3.run(() => {
                                    setTimeout(() => {
                                        expect(ExecutionContext.stack()).to.deep.equal([ context3, context2, context ]);
                                        executionsObserved += 1;
                                    });
                                });
                            });
                        });
                    });
                });

                context3.run(() => {
                    setTimeout(() => {
                        context2.run(() => {
                            setTimeout(() => {
                                context.run(() => {
                                    setTimeout(() => {
                                        expect(ExecutionContext.stack()).to.deep.equal([ context, context2, context3 ]);
                                        executionsObserved += 1;
                                    });
                                });
                            });
                        });
                    });
                });

                setTimeout(() => {
                    context.run(() => {
                        setTimeout(() => {
                            context2.run(() => {
                                setTimeout(() => {
                                    context3.run(() => {
                                        setTimeout(() => {
                                            expect(ExecutionContext.stack()).to.deep.equal([ context3, context2, context ]);
                                            executionsObserved += 1;
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
                
                setTimeout(() => {
                    expect(executionsObserved).to.equal(5);
                }, 1000);
            });

            it('tracks current ExecutionContext across async Node tasks', () => {
                let context1 = new ExecutionContext();
                let context2 = new ExecutionContext();
                let contextsWithinReadFile = null;

                context1.run(() => {
                    const fs = require('fs');
                    const path = require('path');

                    fs.readFile(path.join('..', 'test', 'fixtures', 'file.txt'), (err, data) => {
                        contextsWithinReadFile = ExecutionContext.stack();
                        expect(ExecutionContext.stack()).to.deep.equal([ context1 ]);
                    });

                    context2.run(() => {
                        setTimeout(() => {
                            expect(ExecutionContext.stack()).to.deep.equal([ context2, context1 ]);
                        }, 100);
                    });
                });
            });
        });

        describe('.current()', it => {
            it('returns undefined when called outside of any ExecutionContext', () => {
                expect(ExecutionContext.current()).to.be.undefined;
            });
            it('returns the ExecutionContext instance at the top of the context stack', () => {
                let executionsObserved = 0;
                let context = new ExecutionContext();
                let context2 = new ExecutionContext();

                context.run(() => {
                    expect(ExecutionContext.current()).to.equal(context);
                    executionsObserved += 1;
                });

                context.run(() => {
                    context2.run(() => {
                        expect(ExecutionContext.current()).to.equal(context2);
                        executionsObserved += 1;
                    });
                });
                
                expect(executionsObserved).to.equal(2);
            });
            it('returns the ExecutionContext instance at the top of the context stack asynchronously', () => {
                let executionsObserved = 0;
                let context = new ExecutionContext();
                let context2 = new ExecutionContext();

                context.run(() => {
                    setTimeout(() => {
                        expect(ExecutionContext.current()).to.equal(context);
                        executionsObserved += 1;
                    });
                });

                context.run(() => {
                    setTimeout(() => {
                        context2.run(() => {
                            setTimeout(() => {
                                expect(ExecutionContext.current()).to.equal(context2);
                                executionsObserved += 1;
                            });
                        });
                    })
                });
                
                setTimeout(() => {
                    expect(executionsObserved).to.equal(2);
                }, 1000);
            });
        });

        describe('.fetch()', it => {
            it('does not run the provided callback if a matching ExecutionContext is not found', () => {
                let observed = 0;
                ExecutionContext.fetch(context => observed += 1);
                expect(observed).to.equal(0);

                class MyExecutionContext extends ExecutionContext {
                }

                let myContext = new MyExecutionContext();
                let genericContext = new ExecutionContext();

                genericContext.run(() => MyExecutionContext.fetch(context => observed += 1));
                expect(observed).to.equal(0);
            });

            it('does run the provided callback if a matching ExecutionContext is found', () => {
                let observed = 0;

                class MyExecutionContext extends ExecutionContext {
                }

                let myContext = new MyExecutionContext();
                let genericContext = new ExecutionContext();

                genericContext.run(() => MyExecutionContext.fetch(context => observed += 1));
                genericContext.run(() => ExecutionContext.fetch(context => observed += 2));
                myContext.run(() => MyExecutionContext.fetch(context => observed += 3));
                myContext.run(() => ExecutionContext.fetch(context => observed += 4));

                expect(observed).to.equal(9);
            });

            it('passes the matching ExecutionContext to the callback', () => {
                let observed = 0;

                class MyExecutionContext extends ExecutionContext {
                }

                let myContext = new MyExecutionContext();
                let genericContext = new ExecutionContext();

                genericContext.run(() => ExecutionContext.fetch(context => expect(context).to.equal(genericContext)));
                myContext.run(() => ExecutionContext.fetch(context => expect(context).to.equal(myContext)));
                myContext.run(() => MyExecutionContext.fetch(context => expect(context).to.equal(myContext)));
            });

            it('returns the matching ExecutionContext that is closest to the top of the context stack', () => {
                let observed = 0;

                class MyExecutionContext extends ExecutionContext {
                }

                let myContext = new MyExecutionContext();
                let myContext2 = new MyExecutionContext();
                let genericContext = new ExecutionContext();
                let genericContext2 = new ExecutionContext();

                genericContext.run(() => {
                    genericContext2.run(() => {
                        ExecutionContext.fetch(context => expect(context).to.equal(genericContext2));
                    });
                });

                genericContext2.run(() => {
                    genericContext.run(() => {
                        ExecutionContext.fetch(context => expect(context).to.equal(genericContext));
                    });
                });

                genericContext.run(() => {
                    myContext.run(() => {
                        ExecutionContext.fetch(context => expect(context).to.equal(myContext));
                    });
                });

                myContext.run(() => {
                    genericContext.run(() => {
                        ExecutionContext.fetch(context => expect(context).to.equal(genericContext));
                    });
                });

                myContext.run(() => {
                    myContext2.run(() => {
                        MyExecutionContext.fetch(context => expect(context).to.equal(myContext2));
                    });
                });

                myContext.run(() => {
                    genericContext.run(() => {
                        MyExecutionContext.fetch(context => expect(context).to.equal(myContext));
                    });
                });
            });
        });

        describe('#run()', it => {
            it('should execute the given callback exactly once', () => {
                let context = new ExecutionContext();
                let observed = 0;
                context.run(() => observed += 1);
                expect(observed).to.equal(1);
            });
            it('should retain the value of \'this\'', () => {
                let context = new ExecutionContext();
                let observed = 0;
                let object = {};
                let observedThis = undefined;
                let callable = function() {
                    observedThis = this;
                };
                let boundCallable = callable.bind(object);

                context.run(boundCallable);
                expect(observedThis).to.equal(object);
            });

            it('should run an unbound function with \'this\' set to \'window\'', () => {
                let context = new ExecutionContext();
                let observedThis = undefined;
                let callable = function() {
                    observedThis = this;
                };

                context.run(callable);
                expect(observedThis).to.equal(typeof window !== 'undefined' ? window : global);
            });

            it('should not eat errors thrown synchronously', () => {
                let context = new ExecutionContext();
                let observed = 0;
                let error = new Error();

                try {
                    context.run(() => {
                        throw error;
                    });
                } catch (e) {
                    expect(e).to.equal(error);
                    return;
                }

                throw new Error("This should not be reached!");
            });

            it('should pass through the return value of the callback', () => {
                let value = new ExecutionContext().run(() => 123);
                expect(value).to.equal(123);
            });

            it('should run the callback inline, not in a new VM turn', () => {
                let observed = 0;
                new ExecutionContext().run(() => {
                    observed += 123;
                });

                expect(observed).to.equal(123);
            });
        });

        describe('#schedule()', it => {
            it('should be called only once (for sync task) unless a new task is scheduled', () => {
                let observed = 0;

                class MyContext extends ExecutionContext {
                    schedule(task : ExecutionTask) {
                        observed += 1;
                    }
                }

                let context = new MyContext();
                context.run(() => {});

                expect(observed).to.equal(1);
            });
            it('should be called for a setTimeout()', () => {
                let observed = 0;

                class MyContext extends ExecutionContext {
                    schedule(task : ExecutionTask) {
                        observed += 1;
                    }
                }

                let context = new MyContext();
                context.run(() => {
                    setTimeout(() => {});
                });

                expect(observed).to.equal(2);
            });
            it('should be called for an outstanding Promise', () => {
                let observed = 0;

                class MyContext extends ExecutionContext {
                    schedule(task : ExecutionTask) {
                        observed += 1;
                    }
                }

                let context = new MyContext();
                context.run(() => {
                    let promise = new Promise((resolve, reject) => {
                        resolve();
                    });

                    promise.then(() => {});
                });

                expect(observed).to.equal(2);
            });
            it('should not be able to intercept a Promise rejected by Exception', () => {
                let exceptionsCaught = 0;
                let properlyRouted = 0;

                class MyContext extends ExecutionContext {
                    schedule(task : ExecutionTask) {
                        if (task.type === 'sync')
                            return;

                        task.wrap(unit => (...args) => {
                            try {
                                unit(...args);
                            } catch (e) {
                                exceptionsCaught += 1;
                                throw e;
                            }
                        });
                    }
                }

                let context = new MyContext();
                context.run(() => {
                    let promise = Promise.resolve()
                        .then(() => {
                            throw new Error();
                        })
                        .catch(e => {
                            properlyRouted += 1;
                        })
                    ;

                    promise.then(() => {});
                });

                setTimeout(() => {
                    expect(exceptionsCaught).to.equal(0);
                    expect(properlyRouted).to.equal(1);
                }, 50);
            });
            it('should be called for setInterval', () => {
                let observed = 0;

                class MyContext extends ExecutionContext {
                    schedule(task : ExecutionTask) {
                        observed += 1;
                    }
                }

                let context = new MyContext();
                context.run(() => {
                    let interval;
                    
                    interval = setInterval(() => {
                        clearInterval(interval);
                    }, 50);
                });

                expect(observed).to.equal(2);
            });
            it('should treat each iteration of setInterval as a new scheduled task', () => {
                let observed = 0;

                class MyContext extends ExecutionContext {
                    schedule(task : ExecutionTask) {
                        observed += 1;
                    }
                }

                let context = new MyContext();
                let iteration = 0;

                context.run(() => {
                    let interval;

                    interval = setInterval(() => {
                        ++iteration;

                        if (iteration === 3)
                            clearInterval(interval);
                    }, 6);
                });

                setTimeout(() => {
                    expect(observed, "should call schedule() once per setInterval iteration + 1 for sync task")
                        .to.equal(4);
                    expect(iteration, "should have completed 3 iterations before clearing interval")
                        .to.equal(3);
                }, 40);
            });
        });

        describe('#wrap()', it => {
            it('produces an executable function', () => {
                expect(new ExecutionContext().wrap(() => {})).to.be.a('function');
            });

            it('produces a function that runs the original function', () => {
                let context = new ExecutionContext();
                let observed = false;

                context.wrap(() => observed = true)();
                expect(observed).to.be.true;
            });

            it('passes parameters through the wrapper to the original function', () => {
                let context = new ExecutionContext();
                let observed : any[];

                context.wrap((param1, param2) => observed = [param1, param2])('foobar', 123);
                expect(observed).to.deep.equal(['foobar', 123]);
            });

            it('runs the passed function within the context', () => {
                let context = new ExecutionContext();
                context.wrap(() => {
                    expect(ExecutionContext.current()).to.equal(context);
                })();
            });

            it('functions correctly for an integrated example', () => {
                let context = new ExecutionContext();
                const SAMPLE_STRING = 'hello, world';
                const SAMPLE_NUMBER = 8675309;
    
                function doSomething(foo : string, bar : number) {
                    expect(foo).to.equal(SAMPLE_STRING);
                    expect(bar).to.equal(SAMPLE_NUMBER);
                    expect(ExecutionContext.current()).to.equal(context);
                }
    
                let wrapped = context.wrap(doSomething);
                wrapped(SAMPLE_STRING, SAMPLE_NUMBER);
    
                let context2 = new ExecutionContext();
    
                context2.run(() => wrapped(SAMPLE_STRING, SAMPLE_NUMBER));
            });
        });
    });
});
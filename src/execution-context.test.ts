import { suite } from "razmin";
import { expect } from 'chai';
import { ExecutionContext } from "./execution-context";
import { ExecutionTask } from "./execution-task";

suite(describe => {
    describe('ExecutionContext', it => {
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
    });
});
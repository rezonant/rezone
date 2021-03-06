import { suite } from "razmin";
import { LifeCycleTracker } from "./lifecycle-tracker";
import { expect } from 'chai';

suite(describe => {
    describe('LifeCycleTracker', it => {
        it('should handle trivial synchronous functions correctly', () => {
            let tracker = new LifeCycleTracker();
            let stable = false;
            tracker.addEventListener('stable', () => {
                stable = true;
            })

            expect(stable).to.equal(false);
            tracker.run(() => {
                expect(stable).to.equal(false);
            });
            expect(stable).to.equal(true);
        });

        it('should handle a simple setTimeout scenario', () => {
            let tracker = new LifeCycleTracker();
            let stable = false;
            let observed = 0;

            tracker.addEventListener('stable', () => {
                stable = true;
            })

            expect(stable).to.equal(false);
            tracker.run(() => {
                expect(stable).to.equal(false);

                setTimeout(() => {
                    observed += 1;
                    expect(stable).to.equal(false);                    
                }, 50);
            });

            expect(stable).to.equal(false);
            setTimeout(() => {
                expect(observed).to.equal(1);
                expect(stable).to.equal(true);
            }, 100)
            expect(stable).to.equal(false);
        });

        it.skip('should not call stable event upon clearInterval until execution has completed', () => {
            let tracker = new LifeCycleTracker();
            let stable = false;
            let observed = 0;

            tracker.addEventListener('stable', () => {
                stable = true;
            })

            expect(stable).to.equal(false);
            tracker.run(() => {
                expect(stable).to.equal(false);

                let interval;
                let iterations = 0;
                let maxIterations = 3;

                interval = setInterval(() => {
                    observed += 1;
                    iterations += 1;

                    if (iterations >= maxIterations) {
                        clearInterval(interval);
                    }

                    expect(stable, `should not be stable on ${iterations}'th iteration`).to.equal(false);
                }, 10);
            });

            expect(stable).to.equal(false);
            setTimeout(() => {
                expect(observed).to.equal(1);
                expect(stable).to.equal(true);
            }, 100)
            expect(stable).to.equal(false);
        });

        it('should handle a complex setTimeout scenario', () => {
            let tracker = new LifeCycleTracker();
            let stable = false;
            tracker.addEventListener('stable', () => {
                stable = true;
            })

            expect(stable).to.equal(false);
            tracker.run(() => {
                expect(stable).to.equal(false);

                setTimeout(() => {
                    expect(stable).to.equal(false);                    
                }, 30);

                setTimeout(() => {
                    expect(stable).to.equal(false);                    
                    setTimeout(() => {
                        expect(stable).to.equal(false);
                    }, 10);
                }, 50);
            });

            expect(stable).to.equal(false);
            setTimeout(() => {
                expect(stable).to.equal(true);
            }, 70)
            expect(stable).to.equal(false);
        });
        
        it('should handle a simple promise scenario', () => {
            let tracker = new LifeCycleTracker();
            let stable = false;
            let observed = 0;

            tracker.addEventListener('stable', () => {
                stable = true;
            })

            function timeout(ms) {
                return new Promise((resolve, reject) => {
                    setTimeout(() => resolve(), ms);
                })
            }

            expect(stable).to.equal(false);
            tracker.run(() => {
                let promise = Promise.resolve().then(() => timeout(20));
                promise.then(() => timeout(10)).then(() => observed += 10);
                promise.then(() => timeout(20)).then(() => observed += 20);

                expect(stable).to.equal(false);
            });

            expect(stable).to.equal(false);
            setTimeout(() => {
                expect(stable).to.equal(false);
            }, 40);
            setTimeout(() => {
                expect(stable).to.equal(true);
                expect(observed).to.equal(30);
            }, 70);
            expect(stable).to.equal(false);
        });

        it('should allow for escaping lifecycle tracking', () => {
            let lifecycleTracker = new LifeCycleTracker();
            let disableLifecycleTracking = new LifeCycleTracker(false);
            let observed = '';

            lifecycleTracker.addEventListener('stable', () => {
                observed += 're-';
            });

            lifecycleTracker.run(() => {
                setTimeout(() => {
                    observed += 'do-';
                }, 10);
                disableLifecycleTracking.run(() => {
                    setTimeout(() => {
                        observed += 'mi-';
                    }, 20)
                });
            });

            setTimeout(() => expect(observed).to.equal('do-re-mi-'), 40);
        });
    });
});
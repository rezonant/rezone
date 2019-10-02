import { suite } from "razmin";
import { expect } from 'chai';
import { UnhandledErrorTracker } from "./unhandled-error-tracker";

suite(describe => {
    describe('UnhandledErrorTracker', it => {
        it('does not emit an error if none occurred', () => {
            let tracker = new UnhandledErrorTracker();
            let wasRun = false;

            tracker.run(() => {
                setTimeout(() => {
                    wasRun = true;
                });
            });

            setTimeout(() => {
                expect(wasRun).to.be.true;
            }, 10);
        });
        it('forwards top level errors', () => {
            let tracker = new UnhandledErrorTracker(true);
            let wasRun = false;
            let observedError = null;
            let thrownError = null;

            tracker.addEventListener('error', e => {
                observedError = e;
            });

            tracker.run(() => {
                setTimeout(() => {
                    wasRun = true;
                    throw thrownError = new Error();
                });
            });

            setTimeout(() => {
                expect(wasRun).to.be.true;
                expect(observedError).to.equal(thrownError);
            }, 10);
        });
        it('does not eat top level errors when stopPropagation = false', () => {
            let outerTracker = new UnhandledErrorTracker(true);
            let outerObservedError = null;
            let wasRun = false;
            let observedError = null;
            let thrownError = null;

            outerTracker.addEventListener('error', e => {
                outerObservedError = e;
            });

            outerTracker.run(() => {
                let tracker = new UnhandledErrorTracker();
    
                tracker.addEventListener('error', e => {
                    observedError = e;
                });
    
                tracker.run(() => {
                    setTimeout(() => {
                        wasRun = true;
                        throw thrownError = new Error();
                    });
                });
            });

            setTimeout(() => {
                expect(wasRun).to.be.true;
                expect(observedError).to.equal(thrownError);
                expect(outerObservedError).to.equal(thrownError);
            }, 10);
        });
        it('does eat top level errors when stopPropagation = true', () => {
            let outerTracker = new UnhandledErrorTracker(true);
            let outerObservedError = null;
            let wasRun = false;
            let observedError = null;
            let thrownError = null;

            outerTracker.addEventListener('error', e => {
                outerObservedError = e;
            });

            outerTracker.run(() => {
                let tracker = new UnhandledErrorTracker(true);
    
                tracker.addEventListener('error', e => {
                    observedError = e;
                });
    
                tracker.run(() => {
                    setTimeout(() => {
                        wasRun = true;
                        throw thrownError = new Error();
                    });
                });
            });

            setTimeout(() => {
                expect(wasRun).to.be.true;
                expect(observedError).to.equal(thrownError);
                expect(outerObservedError).to.be.null;
            }, 10);
        });
    });
});
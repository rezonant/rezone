import { suite } from "razmin";
import { expect } from 'chai';
import { StateTracker } from "./state-tracker";

suite(describe => {
    describe('StateTracker', it => {
        it('exposes its state via the ExecutionContext stack', () => {
            let observed = 0;
            let state1 = new StateTracker({
                foo: 321,
                bar: 'string'
            });
            let state2 = new StateTracker({
                foo: 123
            });

            state1.run(() => {
                state2.run(() => {
                    observed += 1;
                    expect(StateTracker.get('foo')).to.equal(123);
                    expect(StateTracker.get('bar')).to.equal('string');
                });
            });

            state2.run(() => {
                state1.run(() => {
                    observed += 1;
                    expect(StateTracker.get('foo')).to.equal(321);
                    expect(StateTracker.get('bar')).to.equal('string');
                });
            });
        });
    });
});
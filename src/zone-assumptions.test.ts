import { suite } from "razmin";
import { expect } from "chai";

/**
 * This suite tests assumptions about Zone.js.
 */
suite(describe => {
    describe('Zone', it => {
        it('cannot observe synchronous thrown errors which are caught', () => {
            let zoneObservedError = false;
            let callerObservedError = false;

            let appZone = Zone.current.fork({
                name: 'AppZone',
                properties: { 
                    appZone: true
                },
                onHandleError(pz, cz, tz, error) {
                    zoneObservedError = true;
                    return true;
                }
            });

            try {
                appZone.run(() => {
                    throw new Error();
                });
            } catch (e) {
                callerObservedError = true;
            }

            expect(zoneObservedError).to.be.false;
            expect(callerObservedError).to.be.true;
        });

        it('cannot eat synchronous thrown errors which are caught', () => {
            let zoneObservedError = false;
            let callerObservedError = false;

            let appZone = Zone.current.fork({
                name: 'AppZone',
                properties: {
                    appZone: true
                },
                onHandleError(pz, cz, tz, error) {
                    zoneObservedError = true;
                    return false;
                }
            });

            try {
                appZone.run(() => {
                    throw new Error();
                });
            } catch (e) {
                callerObservedError = true;
            }

            expect(zoneObservedError).to.be.false;
            expect(callerObservedError).to.be.true;
        });

        it('cannot eat an error thrown in Promise#then() and caught with Promise#catch()', () => {

            function timeout(time) {
                return new Promise(resolve => setTimeout(() => resolve(), time));
            }

            let zoneObservedError = false;
            let callerObservedError = false;
            let calleeObservedError = false;

            let appZone = Zone.current.fork({
                name: 'AppZone',
                properties: {
                    appZone: true
                },
                onHandleError(pz, cz, tz, error) {
                    zoneObservedError = true;
                    return false;
                }
            });

            try {
                appZone.run(() => {
                    timeout(10).then(() => {
                        throw new Error();
                    }).catch(e => {
                        calleeObservedError = true;
                    });
                });
            } catch (e) {
                callerObservedError = true;
            }

            setTimeout(() => {
                expect(zoneObservedError, 'zone observed error').to.be.false;
                expect(callerObservedError, 'caller observed error').to.be.false;
                expect(calleeObservedError, 'callee observed error').to.be.true;
            }, 20);
        });

        it('can eat an error thrown in Promise#then() and *not* caught with Promise#catch()', () => {

            function timeout(time) {
                return new Promise(resolve => setTimeout(() => resolve(), time));
            }

            let zoneObservedError = false;
            let callerObservedError = false;

            let appZone = Zone.current.fork({
                name: 'AppZone',
                properties: {
                    appZone: true
                },
                onHandleError(pz, cz, tz, error) {
                    zoneObservedError = true;
                    return false;
                }
            });

            try {
                appZone.run(() => {
                    timeout(10).then(() => {
                        throw new Error();
                    });
                });
            } catch (e) {
                callerObservedError = true;
            }

            setTimeout(() => {
                expect(zoneObservedError, 'zone observed error').to.be.true;
                expect(callerObservedError, 'caller observed error').to.be.false;
            }, 20);
        });

        describe('.fork()', it => {
            it('allows you to escape from the current zone', () => {
                let zoneA = Zone.current.fork({ 
                    name: 'ZoneA', 
                    properties: {
                        zoneA: true
                    }
                });

                zoneA.run(() => {
                    let zoneB = Zone.root.fork({
                        name: 'ZoneB',
                        properties: {
                            zoneB: true
                        }
                    })

                    zoneB.run(() => {
                        expect(Zone.current.get('zoneA')).to.be.undefined;
                        expect(Zone.current.get('zoneB')).to.be.true;
                    });
                });
            })

            it('can be improperly used to make caller-driven Zone composition impossible', () => {

                const { doSomethingUseful } = (() => {
                    let exports : any = {};

                    let libraryZone = Zone.current.fork({ 
                        name: 'LibraryZone', 
                        properties: {
                            libraryZone: true
                        }
                    });

                    exports.doSomethingUseful = () => {
                        libraryZone.run(() => {
                            expect(Zone.current.get('libraryZone')).to.be.true;
                            expect(Zone.current.get('appZone')).to.be.undefined;
                        })
                    };

                    return exports;
                })();


                let appZone = Zone.current.fork({
                    name: 'AppZone',
                    properties: { 
                        appZone: true
                    }
                });

                appZone.run(() => {
                    doSomethingUseful();
                });
            });
        })
    })
})
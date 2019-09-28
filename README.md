# rezone [WIP]

A streamlined take on the Zones API meant to be implementable as an ECMAScript standard feature. WARNING: This library is in the earliest development phase, it will change!

## Background Reading

- [Error handling in Zones proposal](https://github.com/domenic/zones/issues/9)
- [Domain Module Postmortem](https://github.com/nodejs/node/blob/4a74fc9776d825115849997f4adacb46f4303494/doc/topics/domain-postmortem.md)
- [Zones for JavaScript](https://github.com/domenic/zones/tree/eb65c6d43b452a877c24561cd64c6901e790ecf0)
- [Zone.js](https://github.com/angular/angular/tree/master/packages/zone.js)


## Define your zones intuitively

Zone.js and the dead ECMAScript Zones proposal have the concept of "forking":

```typescript
export function doSomeWork() {
    Zone.current.fork({
        // ...
    }).run(() => {
        // do some work
    })
};
```

What happens when you fork at the declaration level?

```typescript
const libraryZone = Zone.current.fork({
    // ...
});

export function doSomeWork() {
    libraryZone.run(() => {
        // do some work
    });
}
```

In this case, you fork the root zone, meaning that parent zones do not work as expected.

There is no concept of forking in `rezone`. Just construct your desired ExecutionContext class, and run code within that zone as you need to.

```typescript
export class LogExecutionContext extends ExecutionContext {
    schedule(task : ExecutionTask) {
        task.wrap(callback => (...args) => {
                console.log(`LogExecutionContext: Entered for callback '${callback.name}'`);
                callback(...args);
                console.log(`LogExecutionContext: Exited after callback '${callback.name}'`);
        });
    }
}

function main() {
    let logContext = new LogExecutionContext();
    logContext.run(() => {
        console.log('running in context');
        setTimeout(() => console.log('shouldve caught a frame'), 2000);
    });
}

```

Idioms common to `zone.js` are easier to implement in `rezone`. For instance, to monitor for stability (end of all async traffic):

```typescript
export class TrackExecutionContext extends ExecutionContext {
    private counter = 0;

    schedule(task : ExecutionTask) {
        this.counter += 1;
        let decrement = () => {
            if (--this.counter === 0)
                this.emit('stable');
        };

        task.addEventListener('cancel', () => decrement());
        task.addEventListener('finish', () => decrement());
    }
}

function main() {
    let executionTracker = new TrackExecutionContext();
    executionTracker.addEventListener('stable', () => {
        console.log(`all execution completed`);
    });

    executionTracker.run(() => {
        console.log('running in context');
        setTimeout(() => {
            console.log('shouldve caught a frame');
            setTimeout(() => {
                throw new Error('error here');
            }, 3000)
        }, 2000);
    });
}
```

Error handling is deferred out of `rezone`, but handling errors as part of your `ExecutionContext` is straightforward:

```typescript
export class UnhandledErrorInterceptor extends ExecutionContext {
    schedule(task : ExecutionTask) {
        task.wrap(callback => (...args) => {
            try {
                callback(...args);
            } catch (e) {
                console.error(`UnhandledErrorInterceptor: ${e}`);
                this.emit('error', e);
            }
        });
    }
}

function main() {
    let errorInterceptor = new UnhandledErrorInterceptor();

    errorInterceptor.run(() => {
        console.log('running in context');
        setTimeout(() => {
            console.log('shouldve caught a frame');
            setTimeout(() => {
                throw new Error('error here');
            }, 3000)
        }, 2000);
    });
}

```

You can compose multiple `ExecutionContext`s together with `compose()`:

```typescript
function main() {
    let logContext = new LogExecutionContext();
    let errorInterceptor = new UnhandledErrorInterceptor();
    let executionTracker = new TrackExecutionContext();
    executionTracker.addEventListener('stable', () => {
        console.log(`all execution completed`);
    });

    let context = ExecutionContext.compose(logContext, errorInterceptor, executionTracker);

    context.run(() => {
        console.log('running in context');
        setTimeout(() => {
            console.log('shouldve caught a frame');
            setTimeout(() => {
                throw new Error('error here');
            }, 3000)
        }, 2000);
    });
}
main();

```

## How do I escape?

You do not escape a `rezone`
ExecutionContext with async
code, just as you do not escape a 
function call with synchronous code.
The caller retains control over the 
execution of the callee just
as synchronous execution works.
The zone proposal made it possible 
to change the stack of zones from 
within just as Zone.js does, and 
this makes handling zones correctly
much more complicated.

`rezone` does not allow you to escape 
a zone you are running in by design.

There are some use cases for zone escape,
but such use cases can be implemented
another way. For instance, Angular lets
you drop out of the Angular zone to avoid 
the performance hit of doing change detection
using `NgZone#runOutsideAngular`. It
implements this functionality by dropping into
the parent zone. One could instead implement
this functionality as a zone-local variable,
disabling the change detection code when
the zone-local is appropriately set.

(Zone local idioms coming soon)

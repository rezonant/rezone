# rezone [![CircleCI](https://circleci.com/gh/rezonant/rezone/tree/master.svg?style=shield)](https://circleci.com/gh/rezonant/rezone/tree/master) [![Version](https://img.shields.io/npm/v/@rezonant/execution-context.svg)](https://www.npmjs.com/package/@alterior/annotations) ![License](https://img.shields.io/npm/l/@rezonant/execution-context.svg)

**WARNING: This library is in the earliest development phase, it will change!**

A streamlined take on the Zones API meant to be part of the ECMAScript language and runtime.

## Status

This proposal is a work in progress. It is not yet ready for the ECMAScript committee.

## Background Reading

- [Error handling in Zones proposal](https://github.com/domenic/zones/issues/9)
- [Domain Module Postmortem](https://github.com/nodejs/node/blob/4a74fc9776d825115849997f4adacb46f4303494/doc/topics/domain-postmortem.md)
- [Zones for JavaScript](https://github.com/domenic/zones/tree/eb65c6d43b452a877c24561cd64c6901e790ecf0)
- [Zone.js](https://github.com/angular/angular/tree/master/packages/zone.js)

## Motivation

Execution Contexts let a caller function introspect and alter the execution of a called function at asynchronous boundaries within the path of execution.

As a simple example, consider the following code:

```javascript
window.onload = e => {
  // (1)

  fetch("https://example.com").then(res => {
    // (2)

    return processBody(res.body).then(data => {
      // (5)

      const dialog = html`<dialog>Here's some cool data: ${data}
                          <button>OK, cool</button></dialog>`;
      dialog.show();

      dialog.querySelector("button").onclick = () => {
        // (6)
        dialog.close();
      };
    });
  });
};

function processBody(body) {
  // (3)
  return body.json().then(obj => {
    // (4)
    return obj.data;
  });
}
```

At all six marked points, the "async context" is the same: we're in an "async stack" originating from the load event on window. Note how (3) and (4) are outside the lexical context, but is still part of the same "async stack". And note how the promise chain does not suffice to capture this notion of async stack, as shown by (6).

Execution Contexts (and previously Zones) are meant specifically as a building block to reify this notion of "logical async context". The core new mechanism of this proposal is associating each async operation with a zone. On top of this, other work, perhaps outside of JavaScript proper, can build on this powerful base association. Such work can accomplish things like:

- Associating "context-local data" with the execution context itself, analogous to thread-local storage in other languages, which is accessible to any async operation inside the context.
- Automatically tracking outstanding async operations within a given context, to perform cleanup or rendering or test assertion steps afterward
- Timing the total time spent executing code within a context, for analytics or in-the-field profiling
- Handling all **uncaught exceptions** or **unhandled promise rejections** within a context, instead of letting them propagate to the top level

## Proposed Solution

We represent contexts with an `ExecutionContext` instance (or an instance of a subclass), which has 
the following API:

```typescript

export declare class ExecutionContext extends BaseExecutionContext implements IExecutionContext {
    constructor(...args: any[]);

    static stack<T extends typeof ExecutionContext>(this: T): InstanceType<T>[];
    static current<T extends typeof ExecutionContext>(this: T): InstanceType<T>;
    static fetch<T extends typeof ExecutionContext, R>(this: T, callback: (context: InstanceType<T>) => R): R;
    static compose(...contexts: ExecutionContext[]): IExecutionContext;
    
    [capture]<T extends Function>(func: T): T;              // privileged API
    [captureUnguarded]<T extends Function>(func: T): T;       // privileged API
    wrap<T extends Function>(func: T): T;
    run<T>(func: (...args: any[]) => T): T;
    schedule(task: ExecutionTask): void;
}
```

### Mechanics 

The host environment must take care to implement operations involving asynchronous callbacks 
or Promises with respect to correct propagation of execution context. Specifically, an implementation
must wrap the user-provided async reaction callbacks by using `ExecutionContext.[capture]()`
or `ExecutionContext.[captureUnguarded]()` depending on the nature of the API being implemented.

Note: The `[symbol]` notation used above indicates ECMAScript symbols. Any API defined via ECMAScript symbols should
be considered to be _privileged_, meaning only code that is part of the host environment may use it.
The `[capture*]()` methods are intended to be used only by system-level implementations of asynchronous APIs, 
not by library authors or users directly.

Both variants take a function and return a new function which wraps the original in a call to 
`ExecutionContext#run()`.
The API implementation should call the appropriate `[capture*]()` variant at the point where the asynchronous 
operation is _set up_ to ensure that the correct stack of `ExecutionContext`s are stored.

`[capture]()` runs the callback normally, allowing any exception unhandled within the callback to bubble up through
any wrappers applied by `ExecutionContext#schedule()`, up to the caller (of `[capture()]`) if necessary, which may 
result in a trigger of the global exception handling routines of the host environment.

`[captureUnguarded()]` on the other hand will run the callback within a `try / catch` statement, catch the error, 
allow the `ExecutionContext#run()` operation to complete (skipping any wrappers added by `ExecutionContext` interfaces),
and finally rethrow the error up to the caller (of `[captureUnguarded()]`). 

If the API needs to know about executions thrown from the user's callback (for instance, an implementation of 
`Promise#then()`), it should use `[captureUnguarded]()`. All uses where the global exception handler would be invoked
should use `[capture]()`.

## Features

### Define your zones intuitively

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

### Track Async Tasks

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

### Error Handling

The proper way to do error handling has been a source of contention in the efforts to create a suitable ECMAScript Zones API. However the way error handling works in Zone.js and the Zones for Javascript proposal was correct from the start. The API provided by `rezone` does not directly address error handling use cases because implementing it using the core `schedule()` abstraction is trivial:

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

The error handling code above will trigger only when the thrown error is unhandled. If the error bubbles 
to the top-most _synchronous_ stack frame within a callback supplied to an intrinsic asynchronous API 
the error handling wrapper installed by `UnhandledErrorInterceptor` will be triggered. 

To put it another way, `ExecutionContext` can only _observe_ an exception if that exception is unhandled, 
and thus would have otherwise triggered one of: 

- [HTML's `onerror`](https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onerror), 
- [Node.js' `uncaughtException`](https://nodejs.org/api/process.html#process_event_uncaughtexception), 
- [HTML's `unhandledrejection`](https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event) 
  or the runtime's Unhandled Promise Rejection (UPR) behavior, which on Node.js, is to print this message:

  > (node:92845) [DEP0018] DeprecationWarning: Unhandled promise rejections are deprecated. In the future, 
  > promise rejections that are not handled will **terminate the Node.js process with a non-zero exit code.**

All errors thrown within the function executed inside an `ExecutionContext` which are caught behave just as 
they do if no `ExecutionContext` is present. This applies to errors caught with the following mechanisms:

- `try { } catch { }`
- `Promise#catch()`

### Composition of multiple `ExecutionContext`s 

For convenience, you can compose multiple `ExecutionContext`s together with `compose()`:

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

### Zone-Local Variables

Possibly the most common use of Zones is Zone-local variables. `rezone` eliminates the untyped "zone properties" concept that is present in `zone.js` and the Zones proposal and replaces them with typed traversal of the ExecutionContext stack. This has a number of benefits:

- No chance that two Zone-local properties with the same name will collide, unlike in `zone.js`
- Can be dynamic (`get` / `set` properties)
- Can be functions
- Can be statically analyzed and thus participate in tooling (documentation, intellisense via Typescript, etc)

First, know that you can get the stack of currently executing zones at any time with:

```typescript
ExecutionContext.stack() // eg => [ DeepestContext, LoggerContext, ..., RootContext ]
```

This static method behaves differently when called from a subclass. The list of contexts returned is filtered by the calling type, like so:

```typescript
LoggerContext.stack() // eg => [ LoggerContext ]
```

As a shortcut, you can always get the first entry of the context stack by using `current()`:

```typescript
LoggerContext.current() // => LoggerContext
```

To create a "zone local variable", you simply create a property on your ExecutionContext subclass.
For instance, to create a `requestId` "zone-local variable", you could write:

```typescript
export class RequestIdContext extends ExecutionContext {
    constructor(
        readonly requestId : string
    ) {
    }
}
```

To then access `requestId`, use this:

```typescript
RequestIdContext.current().requestId
```

However, if there is no active `RequestIdContext`, then `.current()` will return `undefined`. 
You can guard against this, or use the convenience method `.fetch()`:

```typescript
let theRequestId = RequestIdContext.fetch(context => context.requestId);
```

When there is a matching context (as returned by `.current()`), `.fetch()` will call your callback. If there is not a matching context, your callback is not called, and `undefined` is returned instead.

## FAQ
### How do I escape?

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

### But what about zones interfering with exceptions in called code?

Zones have never interfered with exception handling 
within the called code. This proposal is no
different. The only exceptions Zones can see (and
`ExecutionContext`s are no different) are
exceptions which bubble to the top of an
async task. Such error would normally
cause an unhandledException or an uncaught
promise rejection error.

### Should I use this to implement a Promise / Observable *library*?

No. `ExecutionContext`, nor `Zones`, nor `domain` should be used to implement a Promise and/or Observable library. In "userland" (meaning not part of the host environment), you do not have any control over the propagation of zones. The Javascript community has been making Promise implementations long before even the `domain` library was introduced in Node.js, and it works just fine. Zones are not a shortcut for implementing promises.

### Couldn't I use it for implementing a snazzy unhandled promise rejection feature?

No. As the implementor of a Promise library you have control over the execution of the function passed to `.then()`. 

For instance:
```
class Promise {
    // ...
    runResolvedCallback(value) {
        try {
            this.resolvedCallback(value);
        } catch (e) {
            // do something with the unhandled promise rejection
        }
    }
}
```
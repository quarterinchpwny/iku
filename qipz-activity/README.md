# qipz-activity

Capacitor Android plugin that detects WALKING / RUNNING in the background and emits events to your Vue app

## Install

```bash
npm install qipz-activity
npx cap sync
```

## API

<docgen-index>

* [`status()`](#status)
* [`start()`](#start)
* [`stop()`](#stop)
* [`requestStartPermissions()`](#requeststartpermissions)
* [`checkStartPermissions()`](#checkstartpermissions)
* [`setDebugEnabled(...)`](#setdebugenabled)
* [`setActivityNotificationsEnabled(...)`](#setactivitynotificationsenabled)
* [`setHighReliabilityMode(...)`](#sethighreliabilitymode)
* [`setAccountKey(...)`](#setaccountkey)
* [`setJsPassiveActive(...)`](#setjspassiveactive)
* [`setGeofences(...)`](#setgeofences)
* [`drainPendingEvents()`](#drainpendingevents)
* [`getPluginLogs(...)`](#getpluginlogs)
* [`getPassiveEvents(...)`](#getpassiveevents)
* [`clearPluginLogs()`](#clearpluginlogs)
* [`addListener('activityChange', ...)`](#addlisteneractivitychange-)
* [`addListener('geofenceTransition', ...)`](#addlistenergeofencetransition-)
* [Interfaces](#interfaces)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### status()

```typescript
status() => Promise<ActivityStatus>
```

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### start()

```typescript
start() => Promise<ActivityStatus>
```

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### stop()

```typescript
stop() => Promise<ActivityStatus>
```

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### requestStartPermissions()

```typescript
requestStartPermissions() => Promise<ActivityStatus>
```

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### checkStartPermissions()

```typescript
checkStartPermissions() => Promise<ActivityStatus>
```

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### setDebugEnabled(...)

```typescript
setDebugEnabled(options: { enabled: boolean; }) => Promise<ActivityStatus>
```

| Param         | Type                               |
| ------------- | ---------------------------------- |
| **`options`** | <code>{ enabled: boolean; }</code> |

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### setActivityNotificationsEnabled(...)

```typescript
setActivityNotificationsEnabled(options: { enabled: boolean; }) => Promise<ActivityStatus>
```

| Param         | Type                               |
| ------------- | ---------------------------------- |
| **`options`** | <code>{ enabled: boolean; }</code> |

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### setHighReliabilityMode(...)

```typescript
setHighReliabilityMode(options: { enabled: boolean; }) => Promise<ActivityStatus>
```

| Param         | Type                               |
| ------------- | ---------------------------------- |
| **`options`** | <code>{ enabled: boolean; }</code> |

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### setAccountKey(...)

```typescript
setAccountKey(options: { accountKey: string; }) => Promise<ActivityStatus>
```

| Param         | Type                                 |
| ------------- | ------------------------------------ |
| **`options`** | <code>{ accountKey: string; }</code> |

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### setJsPassiveActive(...)

```typescript
setJsPassiveActive(options: { active: boolean; }) => Promise<ActivityStatus>
```

| Param         | Type                              |
| ------------- | --------------------------------- |
| **`options`** | <code>{ active: boolean; }</code> |

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### setGeofences(...)

```typescript
setGeofences(options: { geofences: GeofenceConfig[]; }) => Promise<ActivityStatus>
```

| Param         | Type                                          |
| ------------- | --------------------------------------------- |
| **`options`** | <code>{ geofences: GeofenceConfig[]; }</code> |

**Returns:** <code>Promise&lt;<a href="#activitystatus">ActivityStatus</a>&gt;</code>

--------------------


### drainPendingEvents()

```typescript
drainPendingEvents() => Promise<{ events: ActivityEvent[]; }>
```

**Returns:** <code>Promise&lt;{ events: ActivityEvent[]; }&gt;</code>

--------------------


### getPluginLogs(...)

```typescript
getPluginLogs(options?: { limit?: number | undefined; } | undefined) => Promise<{ logs: PluginLogEntry[]; }>
```

| Param         | Type                             |
| ------------- | -------------------------------- |
| **`options`** | <code>{ limit?: number; }</code> |

**Returns:** <code>Promise&lt;{ logs: PluginLogEntry[]; }&gt;</code>

--------------------


### getPassiveEvents(...)

```typescript
getPassiveEvents(options?: GetPassiveEventsOptions | undefined) => Promise<GetPassiveEventsResult>
```

| Param         | Type                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| **`options`** | <code><a href="#getpassiveeventsoptions">GetPassiveEventsOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#getpassiveeventsresult">GetPassiveEventsResult</a>&gt;</code>

--------------------


### clearPluginLogs()

```typescript
clearPluginLogs() => Promise<{ ok: boolean; }>
```

**Returns:** <code>Promise&lt;{ ok: boolean; }&gt;</code>

--------------------


### addListener('activityChange', ...)

```typescript
addListener(eventName: 'activityChange', listenerFunc: (event: ActivityEvent) => void) => Promise<{ remove: () => void; }>
```

| Param              | Type                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| **`eventName`**    | <code>'activityChange'</code>                                               |
| **`listenerFunc`** | <code>(event: <a href="#activityevent">ActivityEvent</a>) =&gt; void</code> |

**Returns:** <code>Promise&lt;{ remove: () =&gt; void; }&gt;</code>

--------------------


### addListener('geofenceTransition', ...)

```typescript
addListener(eventName: 'geofenceTransition', listenerFunc: (event: GeofenceTransitionEvent) => void) => Promise<{ remove: () => void; }>
```

| Param              | Type                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **`eventName`**    | <code>'geofenceTransition'</code>                                                               |
| **`listenerFunc`** | <code>(event: <a href="#geofencetransitionevent">GeofenceTransitionEvent</a>) =&gt; void</code> |

**Returns:** <code>Promise&lt;{ remove: () =&gt; void; }&gt;</code>

--------------------


### Interfaces


#### ActivityStatus

| Prop                               | Type                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------ |
| **`enabled`**                      | <code>boolean</code>                                                     |
| **`lastType`**                     | <code>'WALKING' \| 'RUNNING' \| 'DRIVING' \| 'STILL' \| 'UNKNOWN'</code> |
| **`lastConfidence`**               | <code>number</code>                                                      |
| **`lastEventAt`**                  | <code>number</code>                                                      |
| **`lastStartAt`**                  | <code>number</code>                                                      |
| **`lastStopAt`**                   | <code>number</code>                                                      |
| **`lastError`**                    | <code>string</code>                                                      |
| **`lastDebugLabel`**               | <code>string</code>                                                      |
| **`eventCount`**                   | <code>number</code>                                                      |
| **`canStart`**                     | <code>boolean</code>                                                     |
| **`canNotify`**                    | <code>boolean</code>                                                     |
| **`notificationsGranted`**         | <code>boolean</code>                                                     |
| **`missingPermissions`**           | <code>string[]</code>                                                    |
| **`permissionError`**              | <code>string</code>                                                      |
| **`debugEnabled`**                 | <code>boolean</code>                                                     |
| **`activityNotificationsEnabled`** | <code>boolean</code>                                                     |
| **`highReliabilityModeEnabled`**   | <code>boolean</code>                                                     |
| **`accountKey`**                   | <code>string</code>                                                      |
| **`jsPassiveActive`**              | <code>boolean</code>                                                     |
| **`geofenceCount`**                | <code>number</code>                                                      |


#### GeofenceConfig

| Prop                   | Type                               |
| ---------------------- | ---------------------------------- |
| **`id`**               | <code>string</code>                |
| **`name`**             | <code>string</code>                |
| **`lat`**              | <code>number</code>                |
| **`lng`**              | <code>number</code>                |
| **`radius`**           | <code>number</code>                |
| **`enabled`**          | <code>boolean</code>               |
| **`lastState`**        | <code>'inside' \| 'outside'</code> |
| **`lastTransitionAt`** | <code>number</code>                |


#### ActivityEvent

| Prop             | Type                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| **`type`**       | <code>'WALKING' \| 'RUNNING' \| 'DRIVING' \| 'STILL' \| 'UNKNOWN'</code> |
| **`confidence`** | <code>number</code>                                                      |


#### PluginLogEntry

| Prop            | Type                |
| --------------- | ------------------- |
| **`timestamp`** | <code>number</code> |
| **`source`**    | <code>string</code> |
| **`level`**     | <code>string</code> |
| **`message`**   | <code>string</code> |


#### GetPassiveEventsResult

| Prop             | Type                              |
| ---------------- | --------------------------------- |
| **`events`**     | <code>PassiveEventRecord[]</code> |
| **`limit`**      | <code>number</code>               |
| **`hasMore`**    | <code>boolean</code>              |
| **`nextCursor`** | <code>number \| null</code>       |


#### PassiveEventRecord

| Prop                     | Type                        |
| ------------------------ | --------------------------- |
| **`id`**                 | <code>number</code>         |
| **`timestamp`**          | <code>number</code>         |
| **`lat`**                | <code>number</code>         |
| **`lng`**                | <code>number</code>         |
| **`activityType`**       | <code>string \| null</code> |
| **`activityConfidence`** | <code>number</code>         |
| **`reason`**             | <code>string \| null</code> |
| **`trigger`**            | <code>string \| null</code> |
| **`acc`**                | <code>number</code>         |
| **`vel`**                | <code>number</code>         |
| **`cog`**                | <code>number</code>         |
| **`alt`**                | <code>number</code>         |
| **`provider`**           | <code>string \| null</code> |
| **`deviceId`**           | <code>string \| null</code> |
| **`accountKey`**         | <code>string \| null</code> |
| **`sampleHash`**         | <code>string</code>         |
| **`payloadVersion`**     | <code>number</code>         |
| **`source`**             | <code>string</code>         |
| **`createdAt`**          | <code>number</code>         |
| **`uploadedAt`**         | <code>number \| null</code> |
| **`queueItemId`**        | <code>number \| null</code> |


#### GetPassiveEventsOptions

| Prop         | Type                |
| ------------ | ------------------- |
| **`fromTs`** | <code>number</code> |
| **`toTs`**   | <code>number</code> |
| **`cursor`** | <code>number</code> |
| **`limit`**  | <code>number</code> |


#### GeofenceTransitionEvent

| Prop                 | Type                               |
| -------------------- | ---------------------------------- |
| **`id`**             | <code>string</code>                |
| **`name`**           | <code>string</code>                |
| **`transition`**     | <code>'ENTER' \| 'EXIT'</code>     |
| **`state`**          | <code>'inside' \| 'outside'</code> |
| **`lat`**            | <code>number</code>                |
| **`lng`**            | <code>number</code>                |
| **`distanceMeters`** | <code>number</code>                |
| **`timestamp`**      | <code>number</code>                |

</docgen-api>

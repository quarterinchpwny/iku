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
* [`setGeofences(...)`](#setgeofences)
* [`drainPendingEvents()`](#drainpendingevents)
* [`addListener('activityChange', ...)`](#addlisteneractivitychange-)
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

</docgen-api>

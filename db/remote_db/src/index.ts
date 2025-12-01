import { Hono } from 'hono'
import { otaRoute } from '../routes/ota';
import { locationSync } from '../routes/location-sync';

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

const _apiRoutes = app
  .basePath("/api")
    .route("/ota", otaRoute).route("/location",locationSync);


export default app;
export type ApiRoutes = typeof _apiRoutes;
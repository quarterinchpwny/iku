import { Hono } from 'hono'
import { otaRoute } from '../routes/ota';
import { locationSync } from '../routes/location-sync';


import { cors } from 'hono/cors';

const app = new Hono()
app.use('*', cors({ origin: '*' }));



const _apiRoutes = app
  .basePath("/api")
    .route("/ota", otaRoute).route("/location",locationSync);


export default app;
export type ApiRoutes = typeof _apiRoutes;